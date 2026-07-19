package shuttlers.iisc.com

import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Duration
import java.time.Instant

@CapacitorPlugin(name = "HealthConnect")
class HealthConnectPlugin : Plugin() {

    private val scope = CoroutineScope(Dispatchers.Main)
    private var healthConnectClient: HealthConnectClient? = null

    private val PERMISSIONS = setOf(
        androidx.health.connect.client.permission.HealthPermission.getReadPermission(HeartRateRecord::class),
        androidx.health.connect.client.permission.HealthPermission.getReadPermission(StepsRecord::class),
        androidx.health.connect.client.permission.HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
        androidx.health.connect.client.permission.HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
        androidx.health.connect.client.permission.HealthPermission.getReadPermission(OxygenSaturationRecord::class),
        androidx.health.connect.client.permission.HealthPermission.getReadPermission(SleepSessionRecord::class),
        androidx.health.connect.client.permission.HealthPermission.getReadPermission(RestingHeartRateRecord::class)
    )

    private val permissionRequestContract = PermissionController.createRequestPermissionResultContract()

    override fun load() {
        super.load()
        try {
            if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
                healthConnectClient = HealthConnectClient.getOrCreate(context)
            }
        } catch (e: Exception) {
            Log.e("HealthConnectPlugin", "Health Connect not available", e)
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val ret = JSObject()
        val available = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
        ret.put("available", available)
        call.resolve(ret)
    }

    @PluginMethod
    fun installHealthConnect(call: PluginCall) {
        try {
            val intent = android.content.Intent(android.content.Intent.ACTION_VIEW)
            intent.setPackage("com.android.vending")
            intent.data = android.net.Uri.parse("market://details")
                .buildUpon()
                .appendQueryParameter("id", "com.google.android.apps.healthdata")
                .appendQueryParameter("url", "healthconnect://onboarding")
                .build()
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to launch Play Store", e)
        }
    }

    @PluginMethod
    fun openHealthConnectSettings(call: PluginCall) {
        try {
            val intent = android.content.Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
            intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            call.resolve()
        } catch (e: Exception) {
            call.reject("Failed to open Health Connect settings", e)
        }
    }

    @PluginMethod
    fun requestHealthPermissions(call: PluginCall) {
        if (healthConnectClient == null) {
            call.reject("Health Connect is not available")
            return
        }

        scope.launch {
            try {
                val granted = healthConnectClient!!.permissionController.getGrantedPermissions()
                if (granted.containsAll(PERMISSIONS)) {
                    val ret = JSObject()
                    ret.put("granted", true)
                    call.resolve(ret)
                    return@launch
                }

                val intent = permissionRequestContract.createIntent(context, PERMISSIONS)
                startActivityForResult(call, intent, "handlePermissionRequestResult")
            } catch (e: Exception) {
                call.reject("Failed to request permissions", e)
            }
        }
    }

    @ActivityCallback
    private fun handlePermissionRequestResult(call: PluginCall?, result: androidx.activity.result.ActivityResult) {
        if (call == null) return
        val grantedPermissions = permissionRequestContract.parseResult(result.resultCode, result.data)
        val ret = JSObject()
        if (grantedPermissions.containsAll(PERMISSIONS)) {
            ret.put("granted", true)
            call.resolve(ret)
        } else {
            call.reject("Permissions not granted")
        }
    }

    @PluginMethod
    fun getHeartRateForTimeRange(call: PluginCall) {
        val startStr = call.getString("startTime")
        val endStr = call.getString("endTime")
        
        if (startStr == null || endStr == null || healthConnectClient == null) {
            call.reject("startTime and endTime required, and HealthConnect must be available")
            return
        }

        scope.launch {
            try {
                val startTime = Instant.parse(startStr)
                val endTime = Instant.parse(endStr)
                
                val request = ReadRecordsRequest(
                    recordType = HeartRateRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                )
                
                val response = healthConnectClient!!.readRecords(request)
                
                val samples = JSArray()
                for (record in response.records) {
                    for (sample in record.samples) {
                        val obj = JSObject()
                        obj.put("time", sample.time.toString())
                        obj.put("bpm", sample.beatsPerMinute)
                        samples.put(obj)
                    }
                }
                
                val ret = JSObject()
                ret.put("samples", samples)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Error fetching heart rate", e)
            }
        }
    }

    @PluginMethod
    fun getStepsForTimeRange(call: PluginCall) {
        val startStr = call.getString("startTime")
        val endStr = call.getString("endTime")
        
        if (startStr == null || endStr == null || healthConnectClient == null) {
            call.reject("startTime and endTime required, and HealthConnect must be available")
            return
        }

        scope.launch {
            try {
                val startTime = Instant.parse(startStr)
                val endTime = Instant.parse(endStr)
                
                val request = AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                )
                
                val response = healthConnectClient!!.aggregate(request)
                val steps = response[StepsRecord.COUNT_TOTAL] ?: 0L
                
                val ret = JSObject()
                ret.put("steps", steps)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Error fetching steps", e)
            }
        }
    }

    @PluginMethod
    fun getCaloriesForTimeRange(call: PluginCall) {
        val startStr = call.getString("startTime")
        val endStr = call.getString("endTime")
        
        if (startStr == null || endStr == null || healthConnectClient == null) {
            call.reject("startTime and endTime required, and HealthConnect must be available")
            return
        }

        scope.launch {
            try {
                val startTime = Instant.parse(startStr)
                val endTime = Instant.parse(endStr)
                
                val request = AggregateRequest(
                    metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                )
                
                val response = healthConnectClient!!.aggregate(request)
                val energy = response[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: 0.0
                
                val ret = JSObject()
                ret.put("calories", energy.toLong())
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Error fetching calories", e)
            }
        }
    }

    @PluginMethod
    fun getHrvForTimeRange(call: PluginCall) {
        val startStr = call.getString("startTime")
        val endStr = call.getString("endTime")

        if (startStr == null || endStr == null || healthConnectClient == null) {
            call.reject("startTime and endTime required, and HealthConnect must be available")
            return
        }

        scope.launch {
            try {
                val startTime = Instant.parse(startStr)
                val endTime = Instant.parse(endStr)

                val request = ReadRecordsRequest(
                    recordType = HeartRateVariabilityRmssdRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                )

                val response = healthConnectClient!!.readRecords(request)

                val samples = JSArray()
                for (record in response.records) {
                    val obj = JSObject()
                    obj.put("time", record.time.toString())
                    obj.put("rmssd", record.heartRateVariabilityMillis)
                    samples.put(obj)
                }

                val ret = JSObject()
                ret.put("samples", samples)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Error fetching HRV", e)
            }
        }
    }

    @PluginMethod
    fun getRestingHeartRate(call: PluginCall) {
        val beforeStr = call.getString("before")

        if (beforeStr == null || healthConnectClient == null) {
            call.reject("before required, and HealthConnect must be available")
            return
        }

        scope.launch {
            try {
                val before = Instant.parse(beforeStr)
                val lookback = before.minus(Duration.ofDays(3))

                val request = ReadRecordsRequest(
                    recordType = RestingHeartRateRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(lookback, before)
                )

                val response = healthConnectClient!!.readRecords(request)
                val latest = response.records.maxByOrNull { it.time }

                val ret = JSObject()
                if (latest != null) {
                    ret.put("bpm", latest.beatsPerMinute)
                }
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Error fetching resting heart rate", e)
            }
        }
    }

    @PluginMethod
    fun getSpo2ForTimeRange(call: PluginCall) {
        val startStr = call.getString("startTime")
        val endStr = call.getString("endTime")

        if (startStr == null || endStr == null || healthConnectClient == null) {
            call.reject("startTime and endTime required, and HealthConnect must be available")
            return
        }

        scope.launch {
            try {
                val startTime = Instant.parse(startStr)
                val endTime = Instant.parse(endStr)

                val request = ReadRecordsRequest(
                    recordType = OxygenSaturationRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                )

                val response = healthConnectClient!!.readRecords(request)

                val samples = JSArray()
                for (record in response.records) {
                    val obj = JSObject()
                    obj.put("time", record.time.toString())
                    obj.put("percentage", record.percentage.value)
                    samples.put(obj)
                }

                val ret = JSObject()
                ret.put("samples", samples)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Error fetching SpO2", e)
            }
        }
    }

    @PluginMethod
    fun getSleepForDateRange(call: PluginCall) {
        val startStr = call.getString("startTime")
        val endStr = call.getString("endTime")

        if (startStr == null || endStr == null || healthConnectClient == null) {
            call.reject("startTime and endTime required, and HealthConnect must be available")
            return
        }

        scope.launch {
            try {
                val startTime = Instant.parse(startStr)
                val endTime = Instant.parse(endStr)

                val request = ReadRecordsRequest(
                    recordType = SleepSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startTime, endTime)
                )

                val response = healthConnectClient!!.readRecords(request)

                val sessions = JSArray()
                for (record in response.records) {
                    val totalMinutes = java.time.Duration.between(record.startTime, record.endTime).toMinutes()

                    var deepMinutes = 0L
                    var remMinutes = 0L
                    var lightMinutes = 0L
                    var awakeMinutes = 0L
                    for (stage in record.stages) {
                        val stageMinutes = java.time.Duration.between(stage.startTime, stage.endTime).toMinutes()
                        when (stage.stage) {
                            SleepSessionRecord.STAGE_TYPE_DEEP -> deepMinutes += stageMinutes
                            SleepSessionRecord.STAGE_TYPE_REM -> remMinutes += stageMinutes
                            SleepSessionRecord.STAGE_TYPE_LIGHT -> lightMinutes += stageMinutes
                            SleepSessionRecord.STAGE_TYPE_AWAKE, SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED -> awakeMinutes += stageMinutes
                        }
                    }

                    val obj = JSObject()
                    obj.put("startTime", record.startTime.toString())
                    obj.put("endTime", record.endTime.toString())
                    obj.put("totalMinutes", totalMinutes)
                    obj.put("deepMinutes", deepMinutes)
                    obj.put("remMinutes", remMinutes)
                    obj.put("lightMinutes", lightMinutes)
                    obj.put("awakeMinutes", awakeMinutes)
                    sessions.put(obj)
                }

                val ret = JSObject()
                ret.put("sessions", sessions)
                call.resolve(ret)
            } catch (e: Exception) {
                call.reject("Error fetching sleep data", e)
            }
        }
    }
}
