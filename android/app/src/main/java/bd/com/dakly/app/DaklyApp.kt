package bd.com.dakly.app

import android.app.Application
import bd.com.dakly.app.data.ApiClient
import bd.com.dakly.app.data.Repository
import bd.com.dakly.app.data.SessionStore

/** Holds the app-wide singletons. Small enough that a DI framework isn't worth it. */
class DaklyApp : Application() {
    lateinit var session: SessionStore
        private set
    lateinit var repo: Repository
        private set

    override fun onCreate() {
        super.onCreate()
        session = SessionStore(this)
        val api = ApiClient(this, BuildConfig.API_BASE, session)
        repo = Repository(api, session)
    }
}
