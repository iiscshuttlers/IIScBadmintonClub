package shuttlers.iisc.com;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MatchAlarm")
public class MatchAlarmPlugin extends Plugin {

    @PluginMethod
    public void scheduleAlarm(PluginCall call) {
        String idStr = call.getString("id");
        if (idStr == null) {
            call.reject("Must provide an alarm id");
            return;
        }
        int id = idStr.hashCode();
        
        long triggerAtMillis = call.getLong("triggerAtMillis", 0L);
        if (triggerAtMillis <= 0) {
            call.reject("Must provide a valid triggerAtMillis");
            return;
        }
        
        String title = call.getString("title", "Upcoming Match");
        String message = call.getString("message", "You have a match scheduled soon.");

        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            call.reject("AlarmManager not available");
            return;
        }

        Intent intent = new Intent(context, MatchAlarmReceiver.class);
        intent.putExtra("title", title);
        intent.putExtra("message", message);
        
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 
                id, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                } else {
                    // Fallback to inexact if permission denied
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } else {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
            call.resolve();
        } catch (SecurityException e) {
            call.reject("Permission denied to schedule exact alarms: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void cancelAlarm(PluginCall call) {
        String idStr = call.getString("id");
        if (idStr == null) {
            call.reject("Must provide an alarm id");
            return;
        }
        int id = idStr.hashCode();
        
        Context context = getContext();
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        
        Intent intent = new Intent(context, MatchAlarmReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                context, 
                id, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        
        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }
        call.resolve();
    }
}
