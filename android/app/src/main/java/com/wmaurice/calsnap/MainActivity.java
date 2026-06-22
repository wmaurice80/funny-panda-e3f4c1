package com.wmaurice.calsnap;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Enregistrement plugin HC custom avant super.onCreate()
        registerPlugin(HealthConnectPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
