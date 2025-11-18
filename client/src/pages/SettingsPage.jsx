import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';

const SettingsPage = () => {
  const fileRef = useRef(null);
  const [exportData, setExportData] = useState(null);
  const [status, setStatus] = useState('');
  const [ownerInputs, setOwnerInputs] = useState({});
  const [ownersFromExpenses, setOwnersFromExpenses] = useState([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [ownerStatus, setOwnerStatus] = useState('');
  const [ownerError, setOwnerError] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [isSavingOwners, setIsSavingOwners] = useState(false);
  const [defaultOwner, setDefaultOwner] = useState('');
  const [defaultOwnerStatus, setDefaultOwnerStatus] = useState('');
  const [defaultOwnerError, setDefaultOwnerError] = useState('');
  const [isUpdatingDefaultOwner, setIsUpdatingDefaultOwner] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchSettings = async () => {
      try {
        const data = await api.getSettings();
        if (!isMounted) return;
        const normalized = {};
        (data.ownerProfiles || []).forEach((profile) => {
          if (profile?.name) {
            normalized[profile.name] = String(profile.monthlyNetIncome ?? '');
          }
        });
        setOwnerInputs(normalized);
        setDefaultOwner(typeof data.defaultFixedExpensesOwner === 'string' ? data.defaultFixedExpensesOwner : '');
      } catch (err) {
        if (!isMounted) return;
        setOwnerError('Kunne ikke hente personer: ' + err.message);
      }
    };
    fetchSettings();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchOwners = async () => {
      setOwnersLoading(true);
      try {
        const fixedExpenses = await api.getFixedExpenses();
        if (!isMounted) return;
        const owners = Array.from(
          new Set(
            fixedExpenses
              .flatMap((expense) => (Array.isArray(expense.owners) ? expense.owners : []))
              .filter(Boolean)
          )
        ).sort((a, b) => a.localeCompare(b, 'no'));
        setOwnersFromExpenses(owners);
      } catch (err) {
        if (!isMounted) return;
        setOwnerError((prev) => prev || 'Kunne ikke hente eiere: ' + err.message);
      } finally {
        if (isMounted) {
          setOwnersLoading(false);
        }
      }
    };
    fetchOwners();
    return () => {
      isMounted = false;
    };
  }, []);

  const ownerNames = useMemo(() => {
    const names = new Set();
    ownersFromExpenses.forEach((name) => {
      if (name?.trim()) names.add(name);
    });
    Object.keys(ownerInputs).forEach((name) => {
      if (name?.trim()) names.add(name);
    });
    if (defaultOwner?.trim()) {
      names.add(defaultOwner.trim());
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'no'));
  }, [ownersFromExpenses, ownerInputs, defaultOwner]);

  const handleOwnerIncomeChange = (name, value) => {
    setOwnerInputs((current) => ({ ...current, [name]: value }));
  };

  const handleAddOwner = (event) => {
    event.preventDefault();
    setOwnerStatus('');
    setOwnerError('');
    const trimmed = newOwnerName.trim();
    if (!trimmed) {
      setOwnerError('Skriv inn et navn.');
      return;
    }
    setOwnerInputs((current) => {
      if (Object.prototype.hasOwnProperty.call(current, trimmed)) {
        return current;
      }
      return { ...current, [trimmed]: '' };
    });
    setNewOwnerName('');
  };

  const handleSaveOwners = async () => {
    setOwnerStatus('');
    setOwnerError('');
    setIsSavingOwners(true);
    try {
      const payload = Object.entries(ownerInputs)
        .filter(([name]) => name.trim())
        .filter(([, value]) => value !== '' && value !== null && value !== undefined)
        .map(([name, value]) => {
          const trimmedName = name.trim();
          const numericValue = Number(value);
          if (!Number.isFinite(numericValue) || numericValue < 0) {
            throw new Error(`Beløpet for ${trimmedName} må være et ikke-negativt tall.`);
          }
          return { name: trimmedName, monthlyNetIncome: numericValue };
        });
      const updated = await api.updateSettings({ ownerProfiles: payload });
      const refreshed = {};
      (updated.ownerProfiles || []).forEach((profile) => {
        if (profile?.name) {
          refreshed[profile.name] = String(profile.monthlyNetIncome ?? '');
        }
      });
      setOwnerInputs(refreshed);
      setOwnerStatus('Lagret personlige inntekter.');
    } catch (err) {
      setOwnerError(err.message || 'Kunne ikke lagre inntekter.');
    } finally {
      setIsSavingOwners(false);
    }
  };

  const handleSetDefaultOwner = async (name) => {
    setDefaultOwnerStatus('');
    setDefaultOwnerError('');
    setIsUpdatingDefaultOwner(true);
    try {
      const payload = { defaultFixedExpensesOwner: name || '' };
      const updated = await api.updateSettings(payload);
      setDefaultOwner(typeof updated.defaultFixedExpensesOwner === 'string' ? updated.defaultFixedExpensesOwner : '');
      setDefaultOwnerStatus(name ? `${name} er satt som standard for Faste utgifter.` : 'Standardvisning fjernet.');
    } catch (err) {
      setDefaultOwnerError(err.message || 'Kunne ikke oppdatere standardvisningen.');
    } finally {
      setIsUpdatingDefaultOwner(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await api.exportData();
      setExportData(data);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `budsjett-backup-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Eksport fullført. Fil lastet ned.');
    } catch (err) {
      setStatus(err.message);
    }
  };

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus('Velg en fil først.');
      return;
    }
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      await api.importData(json);
      setStatus('Import fullført! Last siden på nytt for å se endringene.');
    } catch (err) {
      setStatus('Import feilet: ' + err.message);
    }
  };

  return (
    <div className="settings-page">
      <div className="section-header">
        <h2>Innstillinger</h2>
      </div>
      <div className="card-grid">
        <div className="card">
          <h3>Sikkerhetskopi</h3>
          <p>Last ned hele databasen som JSON.</p>
          <button onClick={handleExport}>Eksporter nå</button>
          {exportData && (
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>{JSON.stringify(exportData, null, 2)}</pre>
          )}
        </div>

        <div className="card">
          <h3>Import</h3>
          <p>Importer en tidligere eksport. Dette overskriver eksisterende data.</p>
          <input type="file" ref={fileRef} accept="application/json" />
          <button onClick={handleImport}>Importer</button>
        </div>

        <div className="card owner-income-card">
          <h3>Personer og netto inntekt</h3>
          <p>Navn fra faste utgifter dukker opp automatisk. Legg inn beløp per måned per person.</p>
          {ownersLoading && <p className="muted">Laster personer…</p>}
          {!ownersLoading && ownerNames.length === 0 && (
            <p className="muted">Ingen personer funnet ennå. Legg til en ny person nedenfor.</p>
          )}
          {ownerNames.length > 0 && (
            <div className="owner-income-list">
              {ownerNames.map((name) => (
                <div key={name} className="owner-income-row">
                  <span>{name}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="Beløp (NOK)"
                    value={ownerInputs[name] ?? ''}
                    onChange={(e) => handleOwnerIncomeChange(name, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
          {ownerNames.length > 0 && (
            <div className="default-owner-selector">
              <p style={{ marginTop: '1rem' }}>Velg hvilken tag/navn som skal være standard for Faste utgifter.</p>
              <div className="owner-default-list">
                {ownerNames.map((name) => (
                  <div key={`${name}-default`} className="owner-default-row">
                    <span>{name}</span>
                    {defaultOwner === name ? (
                      <span className="badge">Markert som standard</span>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleSetDefaultOwner(name)}
                        disabled={isUpdatingDefaultOwner}
                      >
                        Marker som standard
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {defaultOwner && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => handleSetDefaultOwner('')}
                  disabled={isUpdatingDefaultOwner}
                  style={{ marginTop: '0.75rem' }}
                >
                  Fjern standardvalg
                </button>
              )}
              {defaultOwnerStatus && (
                <p className="muted" style={{ marginTop: '0.5rem', color: '#16a34a' }}>
                  {defaultOwnerStatus}
                </p>
              )}
              {defaultOwnerError && <p className="error-text">{defaultOwnerError}</p>}
            </div>
          )}
          <form className="inline-form" onSubmit={handleAddOwner} style={{ marginTop: '1rem' }}>
            <label htmlFor="new-owner-input">Legg til person</label>
            <input
              id="new-owner-input"
              placeholder="F.eks. Ola"
              value={newOwnerName}
              onChange={(e) => setNewOwnerName(e.target.value)}
            />
            <button type="submit">Legg til</button>
          </form>
          <button
            type="button"
            onClick={handleSaveOwners}
            disabled={isSavingOwners}
            style={{ marginTop: '1rem' }}
          >
            {isSavingOwners ? 'Lagrer…' : 'Lagre personlige inntekter'}
          </button>
          {ownerStatus && (
            <p className="muted" style={{ marginTop: '0.75rem', color: '#16a34a' }}>
              {ownerStatus}
            </p>
          )}
          {ownerError && <p className="error-text">{ownerError}</p>}
        </div>
      </div>

      {status && <p className="settings-status">{status}</p>}
    </div>
  );
};

export default SettingsPage;
