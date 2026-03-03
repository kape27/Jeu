# Build APK Android

## 1) Prerequis

- Android Studio (SDK Android installe)
- JDK 17 ou 21 (`JAVA_HOME` doit pointer dessus)

Important: avec Java 25, le build Gradle echoue (`Unsupported class file major version 69`).

## 2) Generer le projet Android et synchroniser le web

```bash
npm run android:sync
```

Ce script:
- prepare `www/` depuis `index.html`
- copie les assets web vers `android/app/src/main/assets/public`
- synchronise Capacitor

## 3) Compiler un APK debug

```bash
npm run android:build:debug
```

APK genere ici:

`android/app/build/outputs/apk/debug/app-debug.apk`

## 4) Compiler un APK release

```bash
npm run android:build:release
```

APK release (non signe) ici:

`android/app/build/outputs/apk/release/app-release-unsigned.apk`

## 5) Ouvrir dans Android Studio (recommande)

```bash
npm run android:open
```

Puis:
- `Build > Build Bundle(s) / APK(s) > Build APK(s)`
- ou `Generate Signed Bundle / APK` pour un APK signe

## 6) Si le build echoue a cause de Java

Sous Windows (PowerShell), apres installation d un JDK 21:

```powershell
$env:JAVA_HOME="C:\Program Files\Java\jdk-21"
$env:Path="$env:JAVA_HOME\bin;$env:Path"
java -version
npm run android:build:debug
```
