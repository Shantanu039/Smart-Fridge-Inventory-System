# ESP32 to KS0108 GLCD Pinout Configuration

This table details the 8-bit parallel bus and control line connections mapped between the ESP32 microcontroller and the KS0108-driven 128x64 Graphical LCD display.

| GLCD Pin Name | Description | ESP32 GPIO Pin | Connection Type |
| :--- | :--- | :--- | :--- |
| **DB0 - DB7** | 8-Bit Data Bus | GPIO 12, 13, 14, 27, 26, 25, 33, 32 | Parallel Data Bus |
| **RS / DI** | Register Select (Data/Instruction) | GPIO 19 | Control Line |
| **R/W** | Read / Write Control | GND (Ground) | Hardwired for Write-Only |
| **EN / E** | Enable Signal (Latch Clock) | GPIO 4 | Control Line |
| **CS1** | Chip Select 1 (Left Half Page) | GPIO 5 | Control Line |
| **CS2** | Chip Select 2 (Right Half Page) | GPIO 18 | Control Line |
| **RST** | Hardware Reset Pin | GPIO 21 | Active Low Control |
| **VCC** | Logic Power Supply (+5V) | 5V / VIN | Power |
| **VSS** | System Ground (0V) | GND | Power |