import java.util.Properties

plugins {
    id("com.android.application")
}

val versions = Properties().apply { rootProject.file("version.properties").inputStream().use { load(it) } }

// Release signing: put keystore.properties (storeFile, storePassword, keyAlias, keyPassword)
// in the project root, or pass -PdaklyKeystore=/path/to/keystore.properties. Never commit it.
val keystoreFile = (findProperty("daklyKeystore") as String?)?.let { file(it) } ?: rootProject.file("keystore.properties")
val keystore = Properties().apply { if (keystoreFile.exists()) keystoreFile.inputStream().use { load(it) } }

android {
    namespace = "bd.com.dakly.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "bd.com.dakly.app"
        minSdk = 24
        targetSdk = 35
        resourceConfigurations += listOf("en", "bn")
        versionCode = versions.getProperty("versionCode").toInt()
        versionName = versions.getProperty("versionName")
    }

    signingConfigs {
        if (keystore.isNotEmpty()) {
            create("release") {
                storeFile = File(keystoreFile.parentFile, keystore.getProperty("storeFile"))
                storePassword = keystore.getProperty("storePassword")
                keyAlias = keystore.getProperty("keyAlias")
                keyPassword = keystore.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (keystore.isNotEmpty()) signingConfig = signingConfigs.getByName("release")
        }
        debug {
            applicationIdSuffix = ".debug"
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    buildFeatures {
        buildConfig = false
    }

    lint {
        abortOnError = false
        disable += "SetJavaScriptEnabled"
    }
}
