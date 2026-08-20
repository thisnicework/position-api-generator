/*
  5Hz API Controller - Arduino Joystick Game Movement Sender
  -------------------------------------------------------------
  조이스틱의 기울임(0~1023, 중앙 512)을 읽어
  게임 캐릭터처럼 점을 연속 이동(Joystick Movement Mode)시키는 예제 코드입니다.

  [하드웨어 연결]
  - A0 핀 : 2축 조이스틱 X축 (VRx)
  - A1 핀 : 2축 조이스틱 Y축 (VRy)
  - A2 핀 : 회전각 조절 가변저항 (또는 90도 고정)
*/

const int PIN_X = A0;   // 조이스틱 X축
const int PIN_Y = A1;   // 조이스틱 Y축
const int PIN_ROT = A2; // 회전각 가변저항

// 전송 주기 설정 (ms) - 50ms = 초당 20회 전송 (5Hz~20Hz)
const unsigned long SEND_INTERVAL = 50; 
unsigned long lastSendTime = 0;

void setup() {
  // 보드레이트: 115200 bps
  Serial.begin(115200);
}

void loop() {
  unsigned long currentTime = millis();

  if (currentTime - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = currentTime;

    // 1. 아날로그 조이스틱 원시 값 읽기 (0 ~ 1023, 중립: ~512)
    int rawX = analogRead(PIN_X);
    int rawY = analogRead(PIN_Y);
    int rawRot = analogRead(PIN_ROT);

    // 회전각 변환 (0~1023 -> 0~360도)
    long rotDeg = map(rawRot, 0, 1023, 0, 360);

    /*
      🎮 [게임 방식 이동 (Joystick Movement Mode)]
      아두이노에서는 조이스틱의 원시 값(rawX, rawY)을 그대로 전송하면 됩니다!
      웹 앱에서 중앙값(512)과 데드존(Deadzone)을 자동 계산하여 
      조이스틱을 밀고 있으면 밀고 있는 방향으로 점이 게임처럼 계속 이동합니다.
      조이스틱을 놓으면(중앙 512) 이동을 멈춥니다.
    */
    Serial.print(rawX);
    Serial.print(",");
    Serial.print(rawY);
    Serial.print(",");
    Serial.println(rotDeg);
  }
}
