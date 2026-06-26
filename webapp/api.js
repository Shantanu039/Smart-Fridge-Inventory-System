import { VISION_API_KEY, SERP_API_KEY } from './config.js';
import { db, ref, get, saveToFirebase, setIoTStatus, isSaving } from './db.js';

// --- SYSTEM BUFFER STATE ---
let isInternalProcessing = false;

const cameraInput = document.getElementById('cameraInput');
const scanStatus = document.getElementById('scan-status');

/** Compresses incoming camera imagery to reduce payload latency while dynamically 
 * increasing pixel contrast thresholds to amplify faint dot-matrix typography.
 */
async function compressImage(file) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1000;
            const MAX_HEIGHT = 1000;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // --- CANVAS BITMAP PIXEL CONTRAST ENHANCEMENT ---
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                const factor = (259 * (128 + 255)) / (255 * (259 - 128));
                for (let i = 0; i < data.length; i += 4) {
                    data[i] = factor * (data[i] - 128) + 128;     // Red Channel
                    data[i + 1] = factor * (data[i + 1] - 128) + 128; // Green Channel
                    data[i + 2] = factor * (data[i + 2] - 128) + 128; // Blue Channel
                }
                ctx.putImageData(imgData, 0, 0);
            } catch (e) { console.warn("Image pre-filtering optimization bypassed", e); }

            resolve(canvas.toDataURL('image/jpeg', 0.80));
        };
        img.onerror = () => { resolve(null); };
    });
}

const BarcodeCache = (() => {
    let internalDb = null;
    async function open() {
        if (internalDb) return internalDb;
        return new Promise((res, rej) => {
            const req = indexedDB.open('smartfridge_barcodes', 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore('barcodes', { keyPath: 'code' });
            req.onsuccess = e => { internalDb = e.target.result; res(internalDb); };
            req.onerror = () => rej(null);
        });
    }
    return {
        async get(code) {
            try {
                const idb = await open();
                return new Promise(res => {
                    const req = idb.transaction('barcodes').objectStore('barcodes').get(code);
                    req.onsuccess = () => res(req.result?.name || null);
                    req.onerror = () => res(null);
                });
            } catch { return null; }
        },
        async set(code, name) {
            try {
                const idb = await open();
                return new Promise(res => {
                    const tx = idb.transaction('barcodes', 'readwrite');
                    tx.objectStore('barcodes').put({ code, name, ts: Date.now() });
                    tx.oncomplete = res;
                });
            } catch { /* Fail-safe database bypass */ }
        }
    };
})();

/**
 * UTILITY: Semantic String Parser for Product Nomenclature
 * Scrubs retail metadata (MRP, weights, batch codes) to provide clean strings for GLCD rendering.
 */
function cleanProductName(name) {
    if (!name) return null;

    return name
        .replace(/(MRP|Rs|Incl|Tax|Batch|Net Qty|Weight|Quantity|Best Before|Use By| PRODUCT OF INDIA|:)/gi, '')
        .trim();
}

/**
 * UTILITY: Chronological Serialization
 * Converts parsed DD/MM/YYYY text patterns to standard Unix epochs for sorting logic.
 */
function getTimestampFromDate(dateStr) {
    try {
        const parts = dateStr.split("/");

        const dateObj = new Date(
            parseInt(parts[2]),
            parseInt(parts[1]) - 1,
            parseInt(parts[0])
        );

        return Math.floor(dateObj.getTime() / 1000);

    } catch (e) {
        return 0;
    }
}

/**
 * LOGIC MODULE: Primary Key Mapping & Relational Variant Redirection
 * Queries Firebase dictionary trees to balance SKU changes and promo-pack variations.
 */
async function getProductNameFromBarcode(barcode) {
    if (!barcode) return null;

    const clean = barcode.replace(/\D/g, '');
    if (!clean) return null;

    try {
        const customDbRef = ref(db, `products_database/${clean}`);
        const snapshot = await get(customDbRef);
        if (snapshot.exists()) {
            const payload = snapshot.val();
            
            // RELATIONAL CHECK: Evaluates if payload holds an alias reference to a master SKU primary key
            if (/^\d{13}$/.test(payload)) {
                console.log(`[Variant Matrix Redirection]: Forwarding alias ${clean} -> master SKU: ${payload}`);
                const masterRef = ref(db, `products_database/${payload}`);
                const masterSnapshot = await get(masterRef);
                if (masterSnapshot.exists()) {
                    const masterName = masterSnapshot.val();
                    await BarcodeCache.set(clean, masterName);
                    return masterName;
                }
            }
            
            await BarcodeCache.set(clean, payload);
            return payload;
        }
    } catch (err) { console.warn("Firebase explicit lookup table bypassed:", err); }

    const localHit = await BarcodeCache.get(clean);
    if (localHit) return localHit;

    try {
        const results = await Promise.allSettled([
            fetch(`https://world.openfoodfacts.org/api/v2/product/${clean}.json?fields=product_name`).then(r => r.json())
        ]);

        if (results[0].status === 'fulfilled' && results[0].value?.product?.product_name) {
            const offName = results[0].value.product.product_name;
            await BarcodeCache.set(clean, offName);
            return offName;
        }
    } catch (err) { console.error("External lookups dropped:", err); }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA STRUCTURES: CONTEXTUAL OCR PARSING PATTERNS
// ─────────────────────────────────────────────────────────────────────────────

const MONTH_MAP = {
    jan:1, january:1, feb:2, february:2, mar:3, march:3, apr:4, april:4, may:5,
    jun:6, june:6, jul:7, july:7, aug:8, august:8, sep:9, september:9,
    oct:10, october:10, nov:11, november:11, dec:12, december:12
};

function norm(yStr) {
    const y = +yStr;
    return yStr.length === 2 ? 2000 + y : y;
}

function isValidDate(d, m, y) {
    if (m < 1 || m > 12) return false;
    if (d < 1 || d > 31) return false;
    if (y < 2020 || y > 2040) return false;

    return true;
}

function toDisplayDate(d, m, y) {
    return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

const DATE_PATTERNS = [
    // Standard Numeric Layout Validation Rule (DD/MM/YYYY or D/M/YYYY)
    {
        re: /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4}|\d{2})/g,
        parse: (m) => ({
            d: +m[1],
            m: +m[2],
            y: norm(m[3])
        })
    },
    {
        re: /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{2,4})/gi,
        parse: (m) => ({
            d: 1,
            m: MONTH_MAP[m[1].toLowerCase().substring(0,3)],
            y: norm(m[2])
        })
    }
];

const EXP_KEYWORDS =
/\b(?:exp(?:iry)?\.?|expiry\s*date|use\s*by|use\s*before|best\s*before|b\.?b\.?d?|consume\s*before|valid\s*(?:till|upto|up to)|valid\s*thru|shelf\s*life\s*upto)\b/gi;

/**
 * PARSER CORE: Text Regular Expression Context Matrix Evaluator
 * Scans text layouts for geometric proximity matching against tracking keywords.
 */
function processOCRText(fullText) {
    if (!fullText) return null;

    const text = fullText
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s{2,}/g, ' ');

    const cleanedText = text.replace(/(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{2,4})/g, '$1/$2/$3');

    const expPositions = [];
    let kw;
    EXP_KEYWORDS.lastIndex = 0;

    while ((kw = EXP_KEYWORDS.exec(cleanedText)) !== null) {
        expPositions.push(kw.index + kw[0].length);
    }

    const allDates = [];
    const expDates = [];

    for (const pat of DATE_PATTERNS) {
        pat.re.lastIndex = 0;
        let match;

        while ((match = pat.re.exec(cleanedText)) !== null) {
            const parsed = pat.parse(match);
            if (!isValidDate(parsed.d, parsed.m, parsed.y))
                continue;

            const entry = {
                pos: match.index,
                ...parsed
            };

            const nearExp = expPositions.some(ep =>
                match.index >= ep &&
                match.index <= ep + 55
            );

            if (nearExp) expDates.push(entry);
            allDates.push(entry);
        }
    }

    let chosen = null;

    if (expDates.length > 0) {
        chosen = expDates.reduce((a, b) => {
            const da = new Date(a.y, a.m - 1, a.d);
            const db = new Date(b.y, b.m - 1, b.d);
            return da >= db ? a : b;
        });
    } else if (allDates.length > 0) {
        // Chronological Comparison: Selects the future-most date to prioritize Expiry over Mfg strings
        chosen = allDates.reduce((a, b) => {
            const da = new Date(a.y, a.m - 1, a.d);
            const db = new Date(b.y, b.m - 1, b.d);
            return da >= db ? a : b;
        });
    }

    return chosen
        ? toDisplayDate(chosen.d, chosen.m, chosen.y)
        : null;
}

/**
 * CONTROL LAYER: Asynchronous Multi-Threaded Engine Core
 * Handles barcode localization arrays and cloud vision text tokens concurrently.
 */
async function analyzeImage(dataUrl, mode, rawFile) {
    console.log("=== RUNNING ENGINE V2 (NO TRUNCATION) ===");
    const compressedUrl = await compressImage(rawFile);
    const targetUrl = compressedUrl || dataUrl;
    const base64 = targetUrl.split(',')[1];

    let extractedBarcodeData = null;

    const [visionResponse, barcodeResult] =
        await Promise.allSettled([
        fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${VISION_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requests: [{
                        image: {
                            content: base64
                        },
                        features: [{
                            type: "DOCUMENT_TEXT_DETECTION"
                        }]
                    }]
                })
            }
        ).then(r => r.json()),

        (async () => {
            if (mode === 'date_only')
                return null;

            const codeReader = new ZXing.BrowserMultiFormatReader();
            const hints = new Map();
            hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
            hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8]);
            codeReader.hints = hints;

            try {
                const decode = await codeReader.decodeFromImageUrl(targetUrl);
                if (decode && decode.text) {
                    extractedBarcodeData = decode.text.replace(/\D/g, '');
                    return await getProductNameFromBarcode(decode.text);
                }
                return null;
            } catch (err) {
                return null;
            }
        })()
    ]);

    let foundName =
        barcodeResult.status === 'fulfilled'
            ? barcodeResult.value
            : null;

    let foundDate = null;
    let containsNumericBarcodeString = false;
    let fallbackBarcodeDigits = null;

    if (visionResponse.status === 'fulfilled') {
        const fullText =
            visionResponse.value.responses[0]
            ?.fullTextAnnotation?.text || "";

        if (fullText) {
            foundDate = processOCRText(fullText);

            const cleanTextNoSpaces = fullText.replace(/\s/g, '');
            const IndianEanRegex = /890\d{10}/g;
            const eanMatches = cleanTextNoSpaces.match(IndianEanRegex);
            
            if (eanMatches && eanMatches.length > 0) {
                containsNumericBarcodeString = true;
                fallbackBarcodeDigits = eanMatches[0];
                if (!extractedBarcodeData) {
                    extractedBarcodeData = fallbackBarcodeDigits;
                }
            } else {
                const standardBarcodeRegex = /\d{12,14}/g;
                const matches = cleanTextNoSpaces.match(standardBarcodeRegex);
                if (matches && matches.length > 0) {
                    containsNumericBarcodeString = true;
                    fallbackBarcodeDigits = matches[0];
                    if (!extractedBarcodeData) {
                        extractedBarcodeData = fallbackBarcodeDigits;
                    }
                }
            }

            if (mode !== 'date_only' && !foundName && fallbackBarcodeDigits) {
                console.log(`[Auto-Correct Firewall] Intercepting string fallback. Loading product entry for digits: ${fallbackBarcodeDigits}`);
                foundName = await getProductNameFromBarcode(fallbackBarcodeDigits);
            }

            if (
                mode !== 'date_only' &&
                !foundName
            ) {
                if (containsNumericBarcodeString && !fallbackBarcodeDigits) {
                    console.log("[Safety Firewall] Barcode region identified but decoding was bypassed. Routing to Modal.");
                    foundName = null;
                } else {
                    const lines = fullText
                        .split('\n')
                        .filter(l => l.trim().length > 3 && !/MRP|Rs|Batch|PRODUCT OF/i.test(l));

                    foundName = lines[0] || null;
                }
            }
        }
    }

    return {
        name: cleanProductName(foundName),
        date: foundDate,
        rawBarcode: extractedBarcodeData
    };
}

// --- GLOBAL DESKTOP/MOBILE INTERFACE ACCESSORS ---

window.startSingleScan = () => {
    cameraInput.setAttribute('data-mode', 'single');
    cameraInput.click();
};

window.startBarcodeOnlyScan = () => {
    cameraInput.setAttribute('data-mode', 'barcode_only');
    cameraInput.click();
};

window.startDateOnlyScan = () => {
    cameraInput.setAttribute('data-mode', 'date_only');
    cameraInput.click();
};

// --- DYNAMIC CAMERA CAPTURE EVENTS ---

cameraInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const mode = cameraInput.getAttribute('data-mode');

    if (
        !file ||
        isSaving ||
        isInternalProcessing
    ) {
        return;
    }

    isInternalProcessing = true;
    setIoTStatus("Scanning");
    scanStatus.innerHTML = `⏳ <span>Optimizing Data...</span>`;

    const reader = new FileReader();
    reader.onloadend = async () => {
        const result = await analyzeImage(reader.result, mode, file);

        if (result.rawBarcode && !result.name) {
            window.pendingBarcodeToRegister = result.rawBarcode;
        } else {
            window.pendingBarcodeToRegister = null;
        }

        if (
            mode === 'barcode_only' ||
            mode === 'date_only' ||
            !result.name ||
            !result.date
        ) {
            setIoTStatus("Ready");
            scanStatus.innerHTML = `<i class="fas fa-edit"></i> Please confirm details...`;

            window.showManualModal(
                result.name || "",
                result.date || ""
            );

        } else {
            const ts = getTimestampFromDate(result.date);

            await saveToFirebase(
                result.name,
                result.date,
                1,
                ts
            );

            scanStatus.innerHTML = `✅ Added <b>${result.name}</b>`;
            setIoTStatus("Ready");
        }

        isInternalProcessing = false;
        cameraInput.value = "";
    };

    reader.readAsDataURL(file);
});