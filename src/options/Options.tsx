import { useState, useEffect, useCallback } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface Settings {
  theme: ThemeMode;
  fontSize: number;
  autoSaveEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  fontSize: 15,
  autoSaveEnabled: true,
};

const FONT_SIZE_MIN = 12;
const FONT_SIZE_MAX = 24;

export function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings(): Promise<void> {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        const result = await chrome.storage.local.get('viewerSettings');
        const stored = result['viewerSettings'] as Partial<Settings> | undefined;
        if (stored) {
          setSettings({
            theme: stored.theme ?? DEFAULT_SETTINGS.theme,
            fontSize: stored.fontSize ?? DEFAULT_SETTINGS.fontSize,
            autoSaveEnabled: stored.autoSaveEnabled ?? DEFAULT_SETTINGS.autoSaveEnabled,
          });
        }
      }
    } catch {
      // Storage may not be available
    }
  }

  const saveSettings = useCallback(async (newSettings: Settings) => {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        await chrome.storage.local.set({ viewerSettings: newSettings });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      // Storage may not be available
    }
  }, []);

  const handleThemeChange = useCallback((theme: ThemeMode) => {
    const newSettings = { ...settings, theme };
    setSettings(newSettings);
    void saveSettings(newSettings);
  }, [settings, saveSettings]);

  const handleFontSizeChange = useCallback((fontSize: number) => {
    const clamped = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize));
    const newSettings = { ...settings, fontSize: clamped };
    setSettings(newSettings);
    void saveSettings(newSettings);
  }, [settings, saveSettings]);

  const handleAutoSaveChange = useCallback((autoSaveEnabled: boolean) => {
    const newSettings = { ...settings, autoSaveEnabled };
    setSettings(newSettings);
    void saveSettings(newSettings);
  }, [settings, saveSettings]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Feishu MD Viewer Settings</h1>

        {saved && (
          <div style={styles.savedBanner} role="status" aria-live="polite">
            Settings saved
          </div>
        )}

        {/* Theme selector */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Theme</h2>
          <p style={styles.description}>Choose the visual theme for the viewer.</p>
          <div style={styles.radioGroup} role="radiogroup" aria-label="Theme selection">
            {(['system', 'light', 'dark'] as ThemeMode[]).map((themeOption) => (
              <label key={themeOption} style={styles.radioLabel}>
                <input
                  type="radio"
                  name="theme"
                  value={themeOption}
                  checked={settings.theme === themeOption}
                  onChange={() => handleThemeChange(themeOption)}
                  style={styles.radioInput}
                />
                <span style={styles.radioText}>
                  {themeOption === 'system' ? 'System (auto)' : themeOption === 'light' ? 'Light' : 'Dark'}
                </span>
              </label>
            ))}
          </div>
        </section>

        {/* Font size */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Font Size</h2>
          <p style={styles.description}>
            Adjust the base font size for document content ({FONT_SIZE_MIN}px - {FONT_SIZE_MAX}px).
          </p>
          <div style={styles.fontSizeControl}>
            <button
              style={styles.fontBtn}
              onClick={() => handleFontSizeChange(settings.fontSize - 1)}
              disabled={settings.fontSize <= FONT_SIZE_MIN}
              type="button"
              aria-label="Decrease font size"
            >
              -
            </button>
            <span style={styles.fontSizeDisplay} aria-live="polite" aria-atomic="true">
              {settings.fontSize}px
            </span>
            <button
              style={styles.fontBtn}
              onClick={() => handleFontSizeChange(settings.fontSize + 1)}
              disabled={settings.fontSize >= FONT_SIZE_MAX}
              type="button"
              aria-label="Increase font size"
            >
              +
            </button>
            <input
              type="range"
              min={FONT_SIZE_MIN}
              max={FONT_SIZE_MAX}
              step={1}
              value={settings.fontSize}
              onChange={(e) => handleFontSizeChange(Number(e.target.value))}
              style={styles.slider}
              aria-label="Font size slider"
            />
          </div>
        </section>

        {/* Auto-save toggle */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Auto-Save</h2>
          <p style={styles.description}>
            Automatically save changes when editing documents.
          </p>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={settings.autoSaveEnabled}
              onChange={(e) => handleAutoSaveChange(e.target.checked)}
              style={styles.checkbox}
            />
            <span style={styles.toggleText}>
              {settings.autoSaveEnabled ? 'Auto-save enabled' : 'Auto-save disabled'}
            </span>
          </label>
        </section>

        <footer style={styles.footer}>
          <p style={styles.footerText}>Feishu MD Viewer v0.1.0</p>
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  card: {
    background: '#ffffff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '24px',
    color: '#1f2329',
  },
  savedBanner: {
    background: '#e8f5e8',
    color: '#2e7d32',
    padding: '8px 16px',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '14px',
    fontWeight: '500',
  },
  section: {
    marginBottom: '28px',
    paddingBottom: '24px',
    borderBottom: '1px solid #e5e6eb',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '4px',
    color: '#1f2329',
  },
  description: {
    fontSize: '13px',
    color: '#646a73',
    marginBottom: '12px',
  },
  radioGroup: {
    display: 'flex',
    gap: '16px',
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  radioInput: {
    marginRight: '6px',
  },
  radioText: {
    fontSize: '14px',
    color: '#1f2329',
  },
  fontSizeControl: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  fontBtn: {
    width: '32px',
    height: '32px',
    border: '1px solid #dee0e3',
    borderRadius: '6px',
    background: '#ffffff',
    fontSize: '18px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#1f2329',
  },
  fontSizeDisplay: {
    fontSize: '14px',
    fontWeight: '500',
    minWidth: '40px',
    textAlign: 'center' as const,
  },
  slider: {
    flex: 1,
    height: '4px',
    marginLeft: '12px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
  },
  checkbox: {
    marginRight: '8px',
    width: '16px',
    height: '16px',
  },
  toggleText: {
    fontSize: '14px',
    color: '#1f2329',
  },
  footer: {
    marginTop: '16px',
    paddingTop: '16px',
  },
  footerText: {
    fontSize: '12px',
    color: '#8f959e',
  },
};
