package com.wmaurice.calsnap

import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeout
import java.time.LocalDate
import java.time.ZoneId

private const val TAG = "CalSnapHC"
private const val HC_TIMEOUT_MS = 8000L

@CapacitorPlugin(name = "CalSnapHealthConnect")
class HealthConnectPlugin : Plugin() {

    // Permissions demandées — noms directs, sans RECORDS_TYPE_NAME_MAP
    private val PERMISSIONS: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
    )

    private lateinit var permissionLauncher: ActivityResultLauncher<Set<String>>
    private var pendingPermissionCall: PluginCall? = null

    override fun load() {
        val activity = activity as? ComponentActivity
        if (activity == null) {
            Log.e(TAG, "load() — activity is not a ComponentActivity, launcher not registered")
            return
        }
        try {
            permissionLauncher = activity.registerForActivityResult(
                PermissionController.createRequestPermissionResultContract()
            ) { granted: Set<String> ->
                Log.d(TAG, "Permission result received: ${granted.size} granted")
                val call = pendingPermissionCall ?: return@registerForActivityResult
                pendingPermissionCall = null
                bridge.releaseCall(call)
                val allGranted = PERMISSIONS.all { it in granted }
                val ret = JSObject()
                ret.put("granted", allGranted)
                call.resolve(ret)
            }
            Log.d(TAG, "Permission launcher registered OK")
        } catch (e: Exception) {
            Log.e(TAG, "load() — registerForActivityResult failed: ${e.message}")
        }
    }

    /**
     * Vérifie si Health Connect SDK est disponible sur l'appareil.
     * Synchrone — ne se connecte PAS à HC.
     * Retourne { available: boolean }
     */
    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        try {
            val status = HealthConnectClient.getSdkStatus(context)
            val available = status == HealthConnectClient.SDK_AVAILABLE
            Log.d(TAG, "checkAvailability: sdkStatus=$status available=$available")
            val ret = JSObject()
            ret.put("available", available)
            call.resolve(ret)
        } catch (e: Exception) {
            Log.e(TAG, "checkAvailability error: ${e.message}")
            val ret = JSObject()
            ret.put("available", false)
            call.resolve(ret)
        }
    }

    /**
     * Ouvre le dialog HC pour demander les permissions.
     * Retourne { granted: boolean } après choix utilisateur.
     */
    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        if (!::permissionLauncher.isInitialized) {
            Log.e(TAG, "requestPermissions — launcher not initialized")
            call.reject("Health Connect launcher not initialized")
            return
        }
        bridge.saveCall(call)
        pendingPermissionCall = call
        try {
            permissionLauncher.launch(PERMISSIONS)
            Log.d(TAG, "requestPermissions — launcher started")
        } catch (e: Exception) {
            Log.e(TAG, "requestPermissions — launch failed: ${e.message}")
            pendingPermissionCall = null
            bridge.releaseCall(call)
            call.reject("Failed to launch permission dialog: ${e.message}")
        }
    }

    /**
     * Vérifie les permissions actuellement accordées.
     * Retourne { granted: boolean }
     */
    @PluginMethod
    fun getGrantedPermissions(call: PluginCall) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val granted = withTimeout(HC_TIMEOUT_MS) {
                    val client = HealthConnectClient.getOrCreate(context)
                    client.permissionController.getGrantedPermissions()
                }
                val allGranted = PERMISSIONS.all { it in granted }
                Log.d(TAG, "getGrantedPermissions: allGranted=$allGranted (${granted.size} granted)")
                withContext(Dispatchers.Main) {
                    val ret = JSObject()
                    ret.put("granted", allGranted)
                    call.resolve(ret)
                }
            } catch (e: Exception) {
                Log.e(TAG, "getGrantedPermissions error: ${e.message}")
                withContext(Dispatchers.Main) {
                    call.reject("getGrantedPermissions failed: ${e.message}")
                }
            }
        }
    }

    /**
     * Lit les données du jour passé en paramètre.
     * Paramètre : { date: "YYYY-MM-DD" }
     * Retourne : { totalKcal: number, activeKcal: number, steps: number }
     */
    @PluginMethod
    fun readDailyData(call: PluginCall) {
        val dateStr = call.getString("date")
        if (dateStr.isNullOrBlank()) {
            call.reject("Missing required parameter: date (YYYY-MM-DD)")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val zoneId = ZoneId.systemDefault()
                val localDate = LocalDate.parse(dateStr)
                val startInstant = localDate.atStartOfDay(zoneId).toInstant()
                val endInstant = localDate.plusDays(1).atStartOfDay(zoneId).toInstant()
                val timeRange = TimeRangeFilter.between(startInstant, endInstant)

                val client = withTimeout(HC_TIMEOUT_MS) {
                    HealthConnectClient.getOrCreate(context)
                }

                var totalKcal = 0
                var activeKcal = 0
                var steps = 0L

                try {
                    val res = withTimeout(HC_TIMEOUT_MS) {
                        client.aggregate(
                            AggregateRequest(setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL), timeRange)
                        )
                    }
                    totalKcal = (res[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: 0.0).toInt()
                } catch (e: Exception) {
                    Log.w(TAG, "readDailyData[$dateStr] TotalCalories: ${e.message}")
                }

                try {
                    val res = withTimeout(HC_TIMEOUT_MS) {
                        client.aggregate(
                            AggregateRequest(setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL), timeRange)
                        )
                    }
                    activeKcal = (res[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories ?: 0.0).toInt()
                } catch (e: Exception) {
                    Log.w(TAG, "readDailyData[$dateStr] ActiveCalories: ${e.message}")
                }

                try {
                    val res = withTimeout(HC_TIMEOUT_MS) {
                        client.aggregate(
                            AggregateRequest(setOf(StepsRecord.COUNT_TOTAL), timeRange)
                        )
                    }
                    steps = res[StepsRecord.COUNT_TOTAL] ?: 0L
                } catch (e: Exception) {
                    Log.w(TAG, "readDailyData[$dateStr] Steps: ${e.message}")
                }

                Log.d(TAG, "readDailyData[$dateStr]: totalKcal=$totalKcal activeKcal=$activeKcal steps=$steps")
                withContext(Dispatchers.Main) {
                    val ret = JSObject()
                    ret.put("totalKcal", totalKcal)
                    ret.put("activeKcal", activeKcal)
                    ret.put("steps", steps)
                    call.resolve(ret)
                }
            } catch (e: Exception) {
                Log.e(TAG, "readDailyData[$dateStr] error: ${e.message}")
                withContext(Dispatchers.Main) {
                    call.reject("readDailyData failed: ${e.message}")
                }
            }
        }
    }
}
