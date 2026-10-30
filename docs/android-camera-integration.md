# Android Client Integration Guide: Camera Capture, Photo Uploads & InstaPay

This guide provides drop-in Kotlin / Jetpack Compose code snippets for integrating with the Flatmates backend.

---

## 1. Camera Capture for Receipts (Jetpack Compose)

This implementation launches the device camera, saves a full-resolution photo to a temporary cache file via `FileProvider`, compresses it down to `< 500 KB` (respecting the $0 free-tier limit), and uploads it to `POST /api/v1/uploads/direct`.

### 1.1 AndroidManifest.xml Requirements
```xml
<!-- Camera & Storage Permissions -->
<uses-feature android:name="android.hardware.camera" android:required="false" />

<application>
    <!-- FileProvider for secure photo capture URI -->
    <provider
        android:name="androidx.core.content.FileProvider"
        android:authorities="${applicationId}.fileprovider"
        android:exported="false"
        android:grantUriPermissions="true">
        <meta-data
            android:name="android.support.FILE_PROVIDER_PATHS"
            android:resource="@xml/file_paths" />
    </provider>
</application>
```

`res/xml/file_paths.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<paths>
    <cache-path name="camera_photos" path="." />
</paths>
```

---

### 1.2 Jetpack Compose Receipt Camera Composable

```kotlin
package com.flatmates.app.ui.components

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File

@Composable
fun ReceiptCameraCapture(
    authToken: String,
    onUploadSuccess: (receiptUrl: String) -> Unit,
    onError: (message: String) -> Unit
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var isUploading by remember { mutableStateOf(false) }
    var tempPhotoUri by remember { mutableStateOf<Uri?>(null) }
    var tempPhotoFile by remember { mutableStateOf<File?>(null) }

    val cameraLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && tempPhotoFile != null) {
            isUploading = true
            coroutineScope.launch {
                try {
                    val base64Data = compressImageToBase64(context, tempPhotoFile!!)
                    val uploadedUrl = uploadDirectPhoto(
                        authToken = authToken,
                        imageBase64 = base64Data,
                        type = "receipts",
                        filename = "receipt_${System.currentTimeMillis()}.jpg"
                    )
                    onUploadSuccess(uploadedUrl)
                } catch (e: Exception) {
                    onError(e.localizedMessage ?: "Upload failed")
                } finally {
                    isUploading = false
                    tempPhotoFile?.delete()
                }
            }
        }
    }

    Button(
        onClick = {
            val file = File(context.cacheDir, "receipt_capture_${System.currentTimeMillis()}.jpg")
            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                file
            )
            tempPhotoFile = file
            tempPhotoUri = uri
            cameraLauncher.launch(uri)
        },
        enabled = !isUploading,
        modifier = Modifier.fillMaxWidth().height(48.dp)
    ) {
        if (isUploading) {
            CircularProgressIndicator(modifier = Modifier.size(24.dp), color = MaterialTheme.colorScheme.onPrimary)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Compressing & Uploading...")
        } else {
            Text("📷 Snap Receipt Photo")
        }
    }
}

/**
 * Resizes image to max 1280px on long edge and compresses with JPEG quality 75%
 * strictly keeping output under 500 KB.
 */
suspend fun compressImageToBase64(context: Context, file: File): String = withContext(Dispatchers.IO) {
    val bitmap = BitmapFactory.decodeFile(file.absolutePath)
        ?: throw IllegalStateException("Could not decode photo")

    val maxDim = 1280
    val width = bitmap.width
    val height = bitmap.height
    val scaledBitmap = if (width > maxDim || height > maxDim) {
        val ratio = width.toFloat() / height.toFloat()
        val newWidth = if (ratio > 1) maxDim else (maxDim * ratio).toInt()
        val newHeight = if (ratio > 1) (maxDim / ratio).toInt() else maxDim
        Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true)
    } else {
        bitmap
    }

    val stream = ByteArrayOutputStream()
    scaledBitmap.compress(Bitmap.CompressFormat.JPEG, 75, stream)
    val bytes = stream.toByteArray()

    // Prefix with data URI or pass raw base64
    "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
}
```

---

## 2. Profile Photo (Avatar) Upload

Use `POST /api/v1/auth/me/avatar` to update the logged-in user's profile picture:

```kotlin
suspend fun uploadProfileAvatar(authToken: String, base64Image: String): String = withContext(Dispatchers.IO) {
    val client = OkHttpClient()
    val json = JSONObject().apply {
        put("imageBase64", base64Image)
        put("filename", "avatar.jpg")
    }

    val request = Request.Builder()
        .url("https://<your-vercel-domain>/api/v1/auth/me/avatar")
        .addHeader("Authorization", "Bearer $authToken")
        .post(json.toString().toRequestBody("application/json".toMediaType()))
        .build()

    client.newCall(request).execute().use { response ->
        if (!response.isSuccessful) throw IOException("Failed: ${response.code}")
        val resJson = JSONObject(response.body!!.string())
        resJson.getJSONObject("upload").getString("url")
    }
}
```

---

## 3. InstaPay Payment Link Integration

In Egypt, settling up is done via **InstaPay** using either:
- Payment Link: `https://ipn.eg/S/<username>`
- InstaPay Username / Alias: `username@instapay`

### 3.1 Updating Profile with InstaPay Link

```http
PATCH /api/v1/auth/me
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "instapayLink": "https://ipn.eg/S/ahmed_bahig",
  "instapayUsername": "ahmed_bahig"
}
```

### 3.2 One-Tap Settle-Up in Jetpack Compose

When displaying debt settlement suggestions (`GET /api/v1/households/:id/balances/suggestions`), the response includes `toInstapayLink`. The app displays a "Pay via InstaPay" button that launches the InstaPay payment link directly:

```kotlin
@Composable
fun SettlementSuggestionCard(
    fromUserName: String,
    toUserName: String,
    amountFormatted: String,
    toInstapayLink: String?,
    onRecordPayment: () -> Unit
) {
    val context = LocalContext.current

    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("$fromUserName owes $toUserName", style = MaterialTheme.typography.bodyMedium)
            Text(amountFormatted, style = MaterialTheme.typography.titleLarge)

            Spacer(modifier = Modifier.height(12.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!toInstapayLink.isNullOrBlank()) {
                    Button(
                        onClick = {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(toInstapayLink))
                            context.startActivity(intent)
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF6A1B9A)) // InstaPay Purple
                    ) {
                        Text("⚡ Pay via InstaPay")
                    }
                }

                OutlinedButton(onClick = onRecordPayment) {
                    Text("Mark as Paid")
                }
            }
        }
    }
}
```
