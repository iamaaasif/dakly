package bd.com.dakly.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "session")

/** Stores the API token. The token is the only secret the app keeps on the phone. */
class SessionStore(private val context: Context) {
    private val tokenKey = stringPreferencesKey("token")

    @Volatile
    private var cached: String? = null

    val token: Flow<String?> = context.dataStore.data.map { it[tokenKey] }

    suspend fun current(): String? = cached ?: token.first().also { cached = it }

    suspend fun save(token: String) {
        cached = token
        context.dataStore.edit { it[tokenKey] = token }
    }

    suspend fun clear() {
        cached = null
        context.dataStore.edit { it.remove(tokenKey) }
    }
}
