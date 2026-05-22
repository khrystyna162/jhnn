import { useEffect, useState } from 'react';
import Head from 'next/head';
import { Info, Save, Volume2 } from 'lucide-react';
import { withDashboard } from '@/components/DashboardLayout';
import apiClient from '@/services/api';
import { useToast } from '@/components/Toast';
import { Branch, DisplayLayoutMode, DisplaySettings } from '@/types';

const DEFAULT_SETTINGS: DisplaySettings = {
  branchId: '',
  layoutMode: 'FHD',
  ttsEnabled: true,
  ttsVoice: '',
  ttsRate: 1,
  ttsVolume: 1,
};

function DisplaySettingsPage() {
  const { show } = useToast();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS);

  const [testText, setTestText] = useState('Клієнт, талон А001, пройдіть до вікна 3');

  const [loadingBranches, setLoadingBranches] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [availableUkVoices, setAvailableUkVoices] = useState<SpeechSynthesisVoice[]>([]);

  const pickPreferredUkrainianVoice = (
    voices: SpeechSynthesisVoice[],
    preferredName?: string,
  ): SpeechSynthesisVoice | undefined => {
    if (!voices.length) return undefined;
    if (preferredName) {
      const exact = voices.find((voice) => voice.name === preferredName);
      if (exact) return exact;
    }
    return voices.find((voice) => voice.default) ?? voices[0];
  };

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      const ukVoices = window.speechSynthesis
        .getVoices()
        .filter((voice) => voice.lang.toLowerCase().startsWith('uk'));
      setAvailableUkVoices(ukVoices);
    };

    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
    };
  }, []);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        const data = await apiClient.getBranches();
        setBranches(data);
        if (data.length > 0) {
          setSelectedBranchId(data[0].id);
        }
      } catch (err) {
        show(err instanceof Error ? err.message : 'Не вдалося завантажити філії', 'error');
      } finally {
        setLoadingBranches(false);
      }
    };

    loadBranches();
  }, [show]);

  useEffect(() => {
    if (!selectedBranchId) return;

    const loadSettings = async () => {
      try {
        setLoadingSettings(true);
        const data = await apiClient.getDisplaySettings(selectedBranchId);
        setSettings({
          branchId: selectedBranchId,
          layoutMode: (data.layoutMode ?? 'FHD') as DisplayLayoutMode,
          ttsEnabled: data.ttsEnabled ?? true,
          ttsVoice: data.ttsVoice ?? '',
          ttsRate: data.ttsRate ?? 1,
          ttsVolume: data.ttsVolume ?? 1,
        });
      } catch (err) {
        show(err instanceof Error ? err.message : 'Не вдалося завантажити налаштування табло', 'error');
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, [selectedBranchId, show]);

  const handleSave = async () => {
    if (!selectedBranchId) {
      show('Оберіть філію', 'warning');
      return;
    }

    try {
      setSaving(true);
      await apiClient.updateDisplaySettings(selectedBranchId, {
        layoutMode: settings.layoutMode,
        ttsEnabled: settings.ttsEnabled,
        ttsVoice: settings.ttsVoice || undefined,
        ttsRate: settings.ttsRate,
        ttsVolume: settings.ttsVolume,
      });
      show('Налаштування табло збережено', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при збереженні', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleTestTts = async () => {
    try {
      setTesting(true);
      const result = await apiClient.testDisplayTts(testText);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const ukVoices = window.speechSynthesis
          .getVoices()
          .filter((voice) => voice.lang.toLowerCase().startsWith('uk'));
        const preferredVoice = pickPreferredUkrainianVoice(ukVoices, settings.ttsVoice);

        const utterance = new SpeechSynthesisUtterance(result.text || testText);
        utterance.lang = preferredVoice?.lang ?? 'uk-UA';
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
        utterance.rate = settings.ttsRate;
        utterance.volume = settings.ttsVolume;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);

        if (!preferredVoice) {
          show('Український голос не знайдено в браузері. Використано системний fallback.', 'warning');
        }
      }
      show('Тест TTS виконано', 'success');
    } catch (err) {
      show(err instanceof Error ? err.message : 'Помилка при тесті TTS', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Налаштування табло - SoftTurn</title>
      </Head>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Налаштування табло</h1>
            <p className="text-gray-600 mt-2">Керування layout та голосовими оголошеннями для відділень</p>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !selectedBranchId || loadingSettings}
          >
            {saving ? (
              <>
                <span className="spinner inline-block mr-2 h-4 w-4"></span>
                Зберігаю...
              </>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Save size={16} />
                Зберегти
              </span>
            )}
          </button>
        </div>

        <div className="card">
          <div className="form-group">
            <label className="form-label">Філія</label>
            <select
              className="form-select"
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={loadingBranches}
            >
              {branches.length === 0 ? (
                <option value="">Немає доступних філій</option>
              ) : (
                branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))
              )}
            </select>
            <p className="text-xs text-gray-500 mt-2 inline-flex items-center gap-2">
              <Info size={14} />
              Окремий запис табло створюється автоматично для вибраної філії після натискання &quot;Зберегти&quot;.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card space-y-4">
            <div className="card-header">
              <h2 className="card-title">Параметри екрану</h2>
            </div>

            <div className="form-group">
              <label className="form-label">Режим макету</label>
              <select
                className="form-select"
                value={settings.layoutMode}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    layoutMode: e.target.value as DisplayLayoutMode,
                  }))
                }
                disabled={!selectedBranchId || loadingSettings}
              >
                <option value="FHD">FHD</option>
                <option value="UHD">UHD</option>
              </select>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={settings.ttsEnabled}
                onChange={(e) => setSettings((prev) => ({ ...prev, ttsEnabled: e.target.checked }))}
                disabled={!selectedBranchId || loadingSettings}
              />
              <span className="text-sm text-gray-800 font-medium">Увімкнути TTS</span>
            </label>

            <div className="form-group">
              <label className="form-label">Голос TTS (український)</label>
              <select
                className="form-select"
                value={settings.ttsVoice ?? ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, ttsVoice: e.target.value }))}
                disabled={!selectedBranchId || loadingSettings}
              >
                <option value="">Автоматично (перший український голос)</option>
                {availableUkVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.name}>
                    {voice.name} ({voice.lang}){voice.default ? ' • default' : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                Показано лише голоси з локаллю <strong>uk-*</strong>.
              </p>
              {availableUkVoices.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  У браузері не знайдено українських голосів. Встановіть український voice-пакет ОС/браузера.
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Швидкість TTS: {settings.ttsRate.toFixed(1)}</label>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={settings.ttsRate}
                onChange={(e) => setSettings((prev) => ({ ...prev, ttsRate: Number(e.target.value) }))}
                disabled={!selectedBranchId || loadingSettings}
                className="w-full"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Гучність TTS: {settings.ttsVolume.toFixed(1)}</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={settings.ttsVolume}
                onChange={(e) => setSettings((prev) => ({ ...prev, ttsVolume: Number(e.target.value) }))}
                disabled={!selectedBranchId || loadingSettings}
                className="w-full"
              />
            </div>
          </div>

          <div className="card space-y-4">
            <div className="card-header">
              <h2 className="card-title">Тест оголошення</h2>
            </div>

            <div className="form-group">
              <label className="form-label">Текст</label>
              <textarea
                className="form-input min-h-[120px]"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                maxLength={255}
                disabled={!selectedBranchId || loadingSettings || !settings.ttsEnabled}
              />
              <p className="text-xs text-gray-500 mt-1">Максимум 255 символів</p>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleTestTts}
              disabled={!selectedBranchId || loadingSettings || testing || !settings.ttsEnabled}
            >
              {testing ? (
                <>
                  <span className="spinner inline-block mr-2 h-4 w-4"></span>
                  Тестую...
                </>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Volume2 size={16} />
                  Тест TTS
                </span>
              )}
            </button>

            {!settings.ttsEnabled && (
              <div className="alert alert-warning">TTS вимкнено. Увімкніть опцію, щоб запустити тест.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default withDashboard(DisplaySettingsPage);
