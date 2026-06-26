#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <U8g2lib.h>
#include <time.h>

// --- HARDWARE DEPLOYMENT: MASKED INFRASTRUCTURE CONFIGURATIONS ---
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#define DATABASE_SECRET "YOUR_FIREBASE_DATABASE_SECRET_KEY"
#define DATABASE_URL "https://smartfridgeinventory-7112e-default-rtdb.firebaseio.com"

// --- PHYSICAL GLCD BUS & CONTROL PIN DEFINITIONS ---
int dataPins[8] = {12, 13, 14, 27, 26, 25, 33, 32};
#define RS 19
#define EN 4
#define CS1 5
#define CS2 18
#define RST 21

// --- SOFTWARE FRAMEBUFFER INSTANCE (U8g2 SW-I2C Dummy Mapping) ---
U8G2_SSD1306_128X64_NONAME_F_SW_I2C u8g2(U8G2_R0, 0, 0, U8X8_PIN_NONE);

// --- FIREBASE GLOBAL ALLOCATIONS ---
FirebaseData fbdoQuery;
FirebaseData fbdoStatus; 
FirebaseAuth auth;
FirebaseConfig config;

// --- RUNTIME SYSTEM REGISTER REGISTERS ---
String userInventoryPath = "";
String activeUsername = "Guest";
String globalAppStatus = "Ready";
unsigned long lastHandshakeAttempt = 0;
unsigned long lastFetch = 0;
unsigned long lastStatusCheck = 0;

// --- HORIZONTAL TEXT SCROLL ENGINE STATE ---
unsigned long lastScrollUpdate = 0;
int globalScrollX = 0;

// --- PRODUCT REGISTRY SCHEMATIC ---
struct Product {
  String name;
  int days;
  long expiryTime;
};

// ─────────────────────────────────────────────────────────────────────────────
// HARDWARE DRIVER MODULE: KS0108 8-BIT INTERFACE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────

void pulseEnable() {
  digitalWrite(EN, HIGH);
  delayMicroseconds(5);
  digitalWrite(EN, LOW);
  delayMicroseconds(5);
}

void sendByte(uint8_t data) {
  for (int i = 0; i < 8; i++) {
    digitalWrite(dataPins[i], (data >> i) & 0x01);
  }
}

void selectChip(int chip) {
  digitalWrite(CS1, chip == 1);
  digitalWrite(CS2, chip == 2);
}

void sendCommand(uint8_t cmd, int chip) {
  digitalWrite(RS, LOW);
  selectChip(chip);
  sendByte(cmd);
  pulseEnable();
}

void sendDisplayData(uint8_t data, int chip) {
  digitalWrite(RS, HIGH);
  selectChip(chip);
  sendByte(data);
  pulseEnable();
}

void glcdInit() {
  pinMode(RST, OUTPUT);
  digitalWrite(RST, LOW);
  delay(100);
  digitalWrite(RST, HIGH);
  delay(100);
  sendCommand(0x3F, 1); sendCommand(0x3F, 2); 
  sendCommand(0xC0, 1); sendCommand(0xC0, 2); 
}

/**
 * FEATURE: Buffer Synchronization Routine
 * Iterates through U8g2's full frame software buffer and maps page/column matrices 
 * directly over to physical display drivers using chip segmentation protocols.
 */
void manualRefresh() {
  uint8_t *buffer = u8g2.getBufferPtr();
  for (int page = 0; page < 8; page++) {
    for (int chip = 1; chip <= 2; chip++) {
      sendCommand(0xB8 | page, chip);
      sendCommand(0x40, chip);
      for (int col = 0; col < 64; col++) {
        int x = (chip == 2) ? col + 64 : col;
        sendDisplayData(buffer[page * 128 + x], chip);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ARITHMETIC CORE: CHRONOLOGICAL RELATIONAL PARSER
// ─────────────────────────────────────────────────────────────────────────────

int getDaysLeft(String dateStr, long &expiryOut) {
  if (dateStr == "" || dateStr.length() < 8) return 999;
  int d, m, y;
  if (sscanf(dateStr.c_str(), "%d/%d/%d", &d, &m, &y) != 3) return 999;
  struct tm exp_tm = {0};
  exp_tm.tm_mday = d; exp_tm.tm_mon = m - 1; exp_tm.tm_year = y - 1900;
  time_t now; time(&now);
  if (now < 100000) return 777; 
  time_t expiry = mktime(&exp_tm);
  expiryOut = (long)expiry;
  struct tm *now_tm = localtime(&now);
  now_tm->tm_hour = 0; now_tm->tm_min = 0; now_tm->tm_sec = 0;
  time_t todayMid = mktime(now_tm);
  return (int)(difftime(expiry, todayMid) / 86400);
}

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY LAYER: DECOUPLED DEVICE AUTHENTICATION HANDSHAKE
// ─────────────────────────────────────────────────────────────────────────────

void performHardwareHandshake() {
  String mac = WiFi.macAddress();
  Serial.println("\n[AUTH] Handshake Triggered for MAC: " + mac);
  if (Firebase.RTDB.getJSON(&fbdoQuery, "/device_registry/" + mac)) {
    if (fbdoQuery.httpCode() == 200) {
      FirebaseJson &json = fbdoQuery.jsonObject();
      FirebaseJsonData res;
      if (json.get(res, "username")) activeUsername = res.stringValue;
      if (json.get(res, "owner_uid")) {
        userInventoryPath = "/users/" + res.stringValue + "/inventory";
        Serial.println("------------------------------------");
        Serial.println("[SUCCESS] Identity Verified: " + activeUsername);
        Serial.println("------------------------------------");
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM INITIALIZATION AND RUNTIME CONTROL
// ─────────────────────────────────────────────────────────────────────────────

void setup() {
  Serial.begin(115200);
  for (int i = 0; i < 8; i++) pinMode(dataPins[i], OUTPUT);
  pinMode(RS, OUTPUT); pinMode(EN, OUTPUT);
  pinMode(CS1, OUTPUT); pinMode(CS2, OUTPUT); pinMode(RST, OUTPUT);

  glcdInit();
  u8g2.begin();
  u8g2.setFont(u8g2_font_6x10_tf);
  
  u8g2.clearBuffer();
  u8g2.drawStr(15, 30, "System Booting...");
  manualRefresh();

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }

  configTime(19800, 0, "pool.ntp.org");
  while (time(nullptr) < 100000) { delay(100); }

  config.database_url = DATABASE_URL;
  config.signer.tokens.legacy_token = DATABASE_SECRET;
  Firebase.begin(&config, &auth);
  performHardwareHandshake();
}

void loop() {
  if (millis() - lastStatusCheck > 1000) {
    lastStatusCheck = millis();
    if (Firebase.RTDB.getString(&fbdoStatus, "/app_status")) globalAppStatus = fbdoStatus.stringData();
  }

  if (userInventoryPath == "" && (millis() - lastHandshakeAttempt > 20000)) {
    performHardwareHandshake();
    lastHandshakeAttempt = millis();
  }

  if (millis() - lastScrollUpdate > 30) {
    lastScrollUpdate = millis();
    globalScrollX++; 
    if (globalScrollX > 66) globalScrollX = -20; 
  }

  u8g2.clearBuffer();

  if (globalAppStatus == "Scanning") {
    u8g2.drawFrame(10, 20, 108, 25);
    u8g2.drawStr(30, 37, "SCANNING...");
    int animX = (millis() / 8) % 100;
    u8g2.drawVLine(14 + animX, 22, 21);
  } 
  else if (userInventoryPath != "") {
    static Product list[5];
    static int total = 0;

    if (millis() - lastFetch > 3000) {
      lastFetch = millis();
      QueryFilter query;
      query.orderBy("expiry_timestamp"); 
      query.limitToFirst(5);

      if (Firebase.RTDB.getJSON(&fbdoQuery, userInventoryPath, &query)) {
        if (fbdoQuery.httpCode() == 200) {
          FirebaseJson &json = fbdoQuery.jsonObject();
          size_t count = json.iteratorBegin();
          total = 0;
          for (size_t i = 0; i < count && total < 5; i++) {
            int type; String key, value;
            json.iteratorGet(i, type, key, value);
            if (value.indexOf("product_name") == -1) continue;
            FirebaseJson item; item.setJsonData(value);
            FirebaseJsonData res;
            if (item.get(res, "product_name")) list[total].name = res.stringValue;
            if (item.get(res, "expiry_date")) {
               long raw = 0;
               list[total].days = getDaysLeft(res.stringValue, raw);
            }
            total++;
          }
          json.iteratorEnd();

          // Bubble Sort Routine (Ascending order alignment verification)
          for (int i = 0; i < total - 1; i++) {
            for (int j = 0; j < total - i - 1; j++) {
              if (list[j].days > list[j + 1].days) {
                Product temp = list[j];
                list[j] = list[j + 1];
                list[j + 1] = temp;
              }
            }
          }
          
          Serial.println("\n--- Inventory Update (Sorted) ---");
          for (int i = 0; i < total; i++) {
            Serial.printf("[%d] %s | %d days\n", i+1, list[i].name.c_str(), list[i].days);
          }
        }
      }
    }

    for (int i = 0; i < total; i++) {
      String pname = list[i].name;
      String pday = (list[i].days < 0) ? "EXP" : String(list[i].days) + "d";
      int y = 12 + (i * 12);
      
      int dayWidth = u8g2.getStrWidth(pday.c_str());
      int x_day = 128 - dayWidth;
      int max_name_width = x_day - 10; 

      if (u8g2.getStrWidth(pname.c_str()) > max_name_width) {
        int scrollShift = globalScrollX;
        if (scrollShift < 0) scrollShift = 0; 
        u8g2.drawStr(0 - scrollShift, y, pname.c_str());
      } else {
        u8g2.drawStr(0, y, pname.c_str());
      }

      u8g2.setDrawColor(0); 
      u8g2.drawBox(x_day - 2, y - 9, dayWidth + 2, 11);
      u8g2.setDrawColor(1); 
      u8g2.drawStr(x_day, y, pday.c_str());
    }
  } else {
    u8g2.drawStr(10, 35, "ID Not Linked...");
  }

  manualRefresh(); 
  delay(30); 
}
