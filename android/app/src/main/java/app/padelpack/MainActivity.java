package app.padelpack;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Кастомные плагины регистрируются ДО super.onCreate (требование Capacitor).
        registerPlugin(YandexAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
