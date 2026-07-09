package shuttlers.iisc.com;

import android.app.Service;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.os.IBinder;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;

public class FloatingScoreService extends Service {
    private WindowManager windowManager;
    private View floatingView;
    private TextView scoreText;
    private WindowManager.LayoutParams params;

    // Static reference to update score from Plugin
    public static FloatingScoreService instance;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;

        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        int layoutFlag;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            layoutFlag = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        } else {
            layoutFlag = WindowManager.LayoutParams.TYPE_PHONE;
        }

        // Programmatically create the floating view
        FrameLayout frame = new FrameLayout(this);
        GradientDrawable shape = new GradientDrawable();
        shape.setShape(GradientDrawable.RECTANGLE);
        shape.setCornerRadius(50f);
        shape.setColor(0xEE1E293B); // Tailwind slate-800
        shape.setStroke(2, 0xFF8B5CF6); // Tailwind violet-500
        frame.setBackground(shape);

        scoreText = new TextView(this);
        scoreText.setText("00 - 00");
        scoreText.setTextColor(0xFFFFFFFF);
        scoreText.setTextSize(28f);
        scoreText.setTypeface(null, android.graphics.Typeface.BOLD);
        scoreText.setPadding(40, 20, 40, 20);
        
        frame.addView(scoreText);
        floatingView = frame;

        params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT);

        params.gravity = Gravity.TOP | Gravity.LEFT;
        params.x = 0;
        params.y = 100;

        windowManager.addView(floatingView, params);

        // Add drag functionality
        floatingView.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;
            private long lastClickTime = 0;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        params.x = initialX + (int) (event.getRawX() - initialTouchX);
                        params.y = initialY + (int) (event.getRawY() - initialTouchY);
                        windowManager.updateViewLayout(floatingView, params);
                        return true;
                    case MotionEvent.ACTION_UP:
                        // Double click to close
                        long clickTime = System.currentTimeMillis();
                        if (clickTime - lastClickTime < 300) {
                            stopSelf();
                        }
                        lastClickTime = clickTime;
                        return true;
                }
                return false;
            }
        });
    }

    public void updateScore(String score) {
        if (scoreText != null) {
            // Must run on main thread if called from outside, but we will ensure plugin calls on UI thread
            scoreText.setText(score);
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (floatingView != null) {
            windowManager.removeView(floatingView);
        }
        instance = null;
    }
}
