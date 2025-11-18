import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement } from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { api } from '../api.js';
import { formatCurrency } from '../utils/format.js';
import { loadSavingsGoals, summarizeSavingsGoals } from '../utils/savings.js';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

const DashboardPage = () => {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [savingsStats, setSavingsStats] = useState(() => summarizeSavingsGoals(loadSavingsGoals()));
  const [hiddenCategories, setHiddenCategories] = useState([]);
  const doughnutRef = useRef(null);

  const fetchSummary = async () => {
    try {
      const data = await api.getSummary();
      setSummary(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  useEffect(() => {
    const updateStats = () => {
      setSavingsStats(summarizeSavingsGoals(loadSavingsGoals()));
    };
    updateStats();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', updateStats);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', updateStats);
      }
    };
  }, []);

  if (error) {
    return <p>Kunne ikke laste data: {error}</p>;
  }

  if (!summary) {
    return <p>Laster...</p>;
  }

  const fixedCategories = summary.fixedExpenseCategoryTotals || [];
  const fixedLevels = summary.fixedExpenseLevelTotals || [];
  const bindingSoon = summary.bindingExpirations || [];

  useEffect(() => {
    setHiddenCategories((current) =>
      current.filter((category) => fixedCategories.some((item) => item.category === category))
    );
  }, [fixedCategories]);

  const hiddenCategorySet = useMemo(() => new Set(hiddenCategories), [hiddenCategories]);

  const visibleCategoryTotals = useMemo(
    () => fixedCategories.filter((item) => !hiddenCategorySet.has(item.category)),
    [fixedCategories, hiddenCategorySet]
  );

  const defaultFixedTotal =
    summary.effectiveFixedExpenseTotal ?? summary.fixedExpenseTotal ?? summary.fixedExpensesTotal ?? 0;

  const visibleFixedTotal = useMemo(() => {
    if (fixedCategories.length === 0) {
      return defaultFixedTotal;
    }
    return visibleCategoryTotals.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  }, [visibleCategoryTotals, fixedCategories.length, defaultFixedTotal]);

  const activeMonthlyNetIncome =
    typeof summary.activeMonthlyNetIncome === 'number'
      ? summary.activeMonthlyNetIncome
      : typeof summary.monthlyNetIncome === 'number'
      ? summary.monthlyNetIncome
      : null;

  const visibleFreeAfterFixed = useMemo(() => {
    if (fixedCategories.length === 0) {
      return summary.freeAfterFixed ?? 0;
    }
    if (typeof activeMonthlyNetIncome === 'number') {
      return activeMonthlyNetIncome - visibleFixedTotal;
    }
    return summary.freeAfterFixed ?? 0;
  }, [activeMonthlyNetIncome, fixedCategories.length, summary.freeAfterFixed, visibleFixedTotal]);

  const handleLegendClick = useCallback((event, legendItem, legend) => {
    const label = legend?.chart?.data?.labels?.[legendItem.index];
    if (!label) {
      return;
    }
    setHiddenCategories((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    );
    legend?.chart?.toggleDataVisibility(legendItem.index);
    legend?.chart?.update();
  }, []);

  useEffect(() => {
    const chart = doughnutRef.current;
    if (!chart) return;
    const labels = chart.data?.labels || [];
    let needsUpdate = false;
    labels.forEach((label, index) => {
      const shouldHide = hiddenCategorySet.has(label);
      const isVisible = chart.getDataVisibility(index);
      if (shouldHide === isVisible) {
        chart.toggleDataVisibility(index);
        needsUpdate = true;
      }
    });
    if (needsUpdate) {
      chart.update();
    }
  }, [hiddenCategorySet, fixedCategories]);

  const doughnutData =
    fixedCategories.length > 0
      ? {
          labels: fixedCategories.map((item) => item.category),
          datasets: [
            {
              label: 'Faste kostnader',
              data: fixedCategories.map((item) => item.total),
              backgroundColor: fixedCategories.map((item) => item.color || '#94a3b8')
            }
          ]
        }
      : null;

  const doughnutOptions = useMemo(
    () => ({
      plugins: {
        legend: {
          position: 'bottom',
          onClick: handleLegendClick
        }
      },
      cutout: '60%'
    }),
    [handleLegendClick]
  );

  const categoryBadgeText =
    fixedCategories.length > 0
      ? hiddenCategories.length > 0
        ? `${visibleCategoryTotals.length}/${fixedCategories.length} kategorier`
        : `${fixedCategories.length} kategorier`
      : '';

  const monthlyForecast = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const date = new Date();
        date.setMonth(date.getMonth() + index);
        const label = date.toLocaleDateString('no-NO', {
          month: 'short',
          year: 'numeric'
        });
        return {
          label,
          fixedCosts: visibleFixedTotal,
          availableAfterFixed: visibleFreeAfterFixed
        };
      }),
    [visibleFixedTotal, visibleFreeAfterFixed]
  );

  const lineData = {
    labels: monthlyForecast.map((item) => item.label),
    datasets: [
      {
        label: 'Faste kostnader',
        data: monthlyForecast.map((item) => item.fixedCosts),
        borderColor: '#6366f1',
        backgroundColor: 'rgba(99,102,241,0.15)'
      },
      {
        label: 'Tilgjengelig etter faste kostnader',
        data: monthlyForecast.map((item) => item.availableAfterFixed),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22,163,74,0.15)'
      }
    ]
  };

  const tagBarData = {
    labels: Object.keys(summary.tagTotals),
    datasets: [
      {
        label: 'Netto',
        data: Object.values(summary.tagTotals),
        backgroundColor: '#4f46e5'
      }
    ]
  };

  return (
    <div>
      <div className="card-grid">
        <div className="card">
          <h3>Faste kostnader per måned</h3>
          <p className="stat">{formatCurrency(visibleFixedTotal)}</p>
          <p className="muted">
            {summary.fixedExpensesCount} aktive avtaler
            {hiddenCategories.length > 0 && ' · Viser kun valgte kategorier fra grafen.'}
          </p>
        </div>
        <div className="card">
          <h3>Tilgjengelig etter faste kostnader</h3>
          <p className="stat" style={{ color: visibleFreeAfterFixed >= 0 ? '#16a34a' : '#dc2626' }}>
            {formatCurrency(visibleFreeAfterFixed)}
          </p>
          <p className="muted">
            Basert på netto inntekt
            {hiddenCategories.length > 0 && ' · Tar hensyn til valgte kategorier fra grafen.'}
          </p>
        </div>
        <div className="card">
          <h3>Sparemål</h3>
          {savingsStats.goalCount > 0 ? (
            <>
              <p className="stat">{savingsStats.avgProgress}%</p>
              <div className="progress-track" aria-label="Spareprogresjon">
                <div className="progress-fill" style={{ width: `${savingsStats.avgProgress}%` }} />
              </div>
              <p className="muted">
                {formatCurrency(savingsStats.totalSaved)} spart av {formatCurrency(savingsStats.totalTarget)}
              </p>
            </>
          ) : (
            <p className="muted">Opprett sparemål for å følge progresjonen her.</p>
          )}
        </div>
      </div>

      <div className="section-header">
        <h2>Fordeling av faste kostnader</h2>
        {doughnutData && <span className="badge">{categoryBadgeText}</span>}
      </div>
      <div className="card">
        {doughnutData ? (
          <div className="chart-wrapper">
            <Doughnut ref={doughnutRef} data={doughnutData} options={doughnutOptions} />
          </div>
        ) : (
          <p className="muted">Registrer faste utgifter for å se fordelingen.</p>
        )}
      </div>

      <div className="card-grid" style={{ marginTop: '1.5rem' }}>
        <div className="card">
          <h3>Prioritering</h3>
          {fixedLevels.map((item) => (
            <div key={item.level} className="pill-row">
              <span>{item.level}</span>
              <strong>{formatCurrency(item.total)}</strong>
            </div>
          ))}
        </div>
        <div className="card">
          <h3>Bindinger neste 90 dager</h3>
          {bindingSoon.length === 0 && <p className="muted">Ingen bindinger som utløper.</p>}
          {bindingSoon.map((item) => (
            <div key={item.id} className="pill-row">
              <span>
                <strong>{item.name}</strong>
                <br />
                <small className="muted">{new Date(item.bindingEndDate).toLocaleDateString('no-NO')}</small>
              </span>
              <div style={{ textAlign: 'right' }}>
                <span className="badge">{item.daysLeft} dager</span>
                <p style={{ margin: '0.35rem 0 0' }}>{formatCurrency(item.amountPerMonth)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="section-header">
        <h2>Månedlige bevegelser</h2>
      </div>
      <div className="card">
        <Line data={lineData} />
      </div>

      {Object.keys(summary.tagTotals).length > 0 && (
        <>
          <div className="section-header">
            <h2>Tag-analyse</h2>
          </div>
          <div className="card">
            <Bar data={tagBarData} />
          </div>
        </>
      )}

    </div>
  );
};

export default DashboardPage;
