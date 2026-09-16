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
import android.widget.LinearLayout;
import android.widget.TextView;
import android.graphics.drawable.GradientDrawable;

import org.json.JSONArray;
import org.json.JSONObject;

public class FloatingScoreService extends Service {
    private WindowManager windowManager;
    private View floatingView;
    private LinearLayout column;
    private WindowManager.LayoutParams params;

    // Static reference to update score from Plugin
    public static FloatingScoreService instance;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("matches")) {
            String matchesJson = intent.getStringExtra("matches");
            updateScore(matchesJson);
        }
        return START_NOT_STICKY;
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
        shape.setCornerRadius(40f);
        shape.setColor(0xF20F172A); // Tailwind slate-900 with ~95% opacity
        shape.setStroke(2, 0xFF334155); // Tailwind slate-700
        frame.setBackground(shape);

        column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(50, 30, 50, 30);

        frame.addView(column);

        // Subtle close button inside the widget
        TextView closeButton = new TextView(this);
        closeButton.setText("✕");
        closeButton.setTextColor(0xFF64748B); // Tailwind slate-500
        closeButton.setTextSize(14f);
        closeButton.setTypeface(null, android.graphics.Typeface.BOLD);
        closeButton.setGravity(android.view.Gravity.CENTER);
        
        FrameLayout.LayoutParams closeParams = new FrameLayout.LayoutParams(60, 60);
        closeParams.gravity = Gravity.TOP | Gravity.RIGHT;
        closeParams.topMargin = 10;
        closeParams.rightMargin = 10;
        closeButton.setOnClickListener(v -> closeOverlay());
        frame.addView(closeButton, closeParams);

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
                            closeOverlay();
                        }
                        lastClickTime = clickTime;
                        return true;
                }
                return false;
            }
        });
    }

    // Dismissed from the overlay itself (close button or double-tap). Tell
    // the JS side so it can clear its pinned-match state — otherwise the
    // next score update would just start the service back up.
    private void closeOverlay() {
        if (FloatingScorePlugin.instance != null) {
            FloatingScorePlugin.instance.notifyClosed();
        }
        stopSelf();
    }

    public void updateScore(String matchesJson) {
        if (column == null) return;
        
        column.removeAllViews();
        
        try {
            JSONArray matches = new JSONArray(matchesJson);
            if (matches.length() == 0) {
                stopSelf();
                return;
            }

            for (int i = 0; i < matches.length(); i++) {
                JSONObject match = matches.getJSONObject(i);
                String score = match.optString("score", "00 - 00");
                String teams = match.optString("teams", "");

                // LIVE indicator above the first match
                if (i == 0) {
                    LinearLayout headerLayout = new LinearLayout(this);
                    headerLayout.setOrientation(LinearLayout.HORIZONTAL);
                    headerLayout.setGravity(Gravity.CENTER);
                    headerLayout.setPadding(0, 0, 0, 12);

                    TextView liveDot = new TextView(this);
                    liveDot.setText("●");
                    liveDot.setTextColor(0xFFEF4444); // red-500
                    liveDot.setTextSize(8f);
                    liveDot.setPadding(0, 0, 8, 0);
                    
                    TextView liveText = new TextView(this);
                    liveText.setText("LIVE BROADCAST");
                    liveText.setTextColor(0xFFEF4444); // red-500
                    liveText.setTextSize(9f);
                    liveText.setTypeface(null, android.graphics.Typeface.BOLD);
                    
                    headerLayout.addView(liveDot);
                    headerLayout.addView(liveText);
                    column.addView(headerLayout);
                }

                if (i > 0) {
                    View divider = new View(this);
                    LinearLayout.LayoutParams divParams = new LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.MATCH_PARENT, 2);
                    divParams.setMargins(0, 20, 0, 20);
                    divider.setLayoutParams(divParams);
                    divider.setBackgroundColor(0xFF1E293B); // Tailwind slate-800
                    column.addView(divider);
                }

                if (!teams.isEmpty()) {
                    TextView teamsText = new TextView(this);
                    String teamsHtml = teams.replace(" vs ", " <font color='#64748B'><i>vs</i></font> ");
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                        teamsText.setText(android.text.Html.fromHtml(teamsHtml, android.text.Html.FROM_HTML_MODE_LEGACY));
                    } else {
                        teamsText.setText(android.text.Html.fromHtml(teamsHtml));
                    }
                    teamsText.setTextColor(0xFFE2E8F0); // Tailwind slate-200
                    teamsText.setTextSize(11f);
                    teamsText.setTypeface(null, android.graphics.Typeface.BOLD);
                    teamsText.setGravity(android.view.Gravity.CENTER);
                    teamsText.setMaxWidth(500);
                    teamsText.setPadding(0, 0, 0, 4);
                    column.addView(teamsText);
                }

                TextView scoreText = new TextView(this);
                // Dim the hyphen in the score
                String scoreHtml = score.replace(" - ", " <font color='#475569'>-</font> ");
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    scoreText.setText(android.text.Html.fromHtml(scoreHtml, android.text.Html.FROM_HTML_MODE_LEGACY));
                } else {
                    scoreText.setText(android.text.Html.fromHtml(scoreHtml));
                }
                scoreText.setTextColor(0xFFFFFFFF);
                scoreText.setTextSize(34f);
                scoreText.setTypeface(null, android.graphics.Typeface.BOLD);
                scoreText.setGravity(android.view.Gravity.CENTER);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    scoreText.setLetterSpacing(0.05f);
                }
                column.addView(scoreText);
            }

            if (floatingView != null && params != null) {
                windowManager.updateViewLayout(floatingView, params);
            }
        } catch (Exception e) {
            e.printStackTrace();
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
