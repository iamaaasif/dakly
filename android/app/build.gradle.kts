import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.roborazzi)
}

val versions = Properties().apply { rootProject.file("version.properties").inputStream().use { load(it) } }

// Release signing: keystore.properties (storeFile, storePassword, keyAlias, keyPassword) in the
// project root, or -PdaklyKeystore=/path/to/keystore.properties. Never commit it.
val keystoreFile = (findProperty("daklyKeystore") as String?)?.let { file(it) } ?: rootProject.file("keystore.properties")
val keystore = Properties().apply { if (keystoreFile.exists()) keystoreFile.inputStream().use { load(it) } }

android {
    namespace = "bd.com.dakly.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "bd.com.dakly.app"
        minSdk = 24
        targetSdk = 35
        versionCode = versions.getProperty("versionCode").toInt()
        versionName = versions.getProperty("versionName")
        // Server root; change for staging with -PdaklyApi=https://staging.example.com
        buildConfigField("String", "API_BASE", "\"${findProperty("daklyApi") ?: "https://app.dakly.com.bd"}\"")
        resourceConfigurations += listOf("en", "bn")
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
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
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // java.time on Android 7.x (API 24-25)
        isCoreLibraryDesugaringEnabled = true
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    testOptions {
        unitTests {
            isIncludeAndroidResources = true
            all {
                it.systemProperty("robolectric.graphicsMode", "NATIVE")
                it.systemProperty("dakly.play", findProperty("daklyPlay") ?: "0")
                it.systemProperty("dakly.testApi", findProperty("daklyApi") ?: "")
                (findProperty("robolectricRepo") as String?)?.let { url -> it.systemProperty("robolectric.dependency.repo.url", url) }
                it.maxHeapSize = "4g"
                it.testLogging { events("passed", "failed", "skipped"); exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL }
            }
        }
    }
    lint {
        abortOnError = false
    }
}

dependencies {
    coreLibraryDesugaring(libs.desugar.jdk.libs)
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.androidx.splashscreen)
    implementation(libs.androidx.browser)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.datastore)
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.libphonenumber)
    debugImplementation(libs.compose.ui.tooling)
    implementation(libs.okhttp.logging)
    testImplementation(libs.junit)
    testImplementation(libs.robolectric)
    testImplementation(libs.androidx.test.core)
    testImplementation(libs.androidx.test.ext.junit)
    testImplementation(libs.compose.ui.test.junit4)
    testImplementation(libs.kotlinx.coroutines.test)
    testImplementation(libs.roborazzi)
    testImplementation(libs.roborazzi.compose)
    testImplementation(libs.roborazzi.junit)
    debugImplementation(libs.compose.ui.test.manifest)
}
