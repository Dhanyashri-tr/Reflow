import UsageChart from "./UsageChart";

import { useMemo, useState } from "react";

import { Authenticator } from "@aws-amplify/ui-react";

import "@aws-amplify/ui-react/styles.css";

import "./App.css";

import { client } from "./amplifyClient";



const initialDemands = [

  { id: 1, name: "Toilet flushing", litres: 2000, enabled: true },

  { id: 2, name: "Landscaping", litres: 1500, enabled: true },

  { id: 3, name: "Floor cleaning", litres: 1000, enabled: true },

];


const BUILDING_ID = "reflow-demo-building-001";
function Planner() {

  const [supply, setSupply] = useState(5000);

  
  const [demands, setDemands] = useState(initialDemands);
  
  const [approved, setApproved] = useState(false);
  
  const [actual, setActual] = useState("0");
  
  const [replaced, setReplaced] = useState("0");
  
  const [verified, setVerified] = useState<number | null>(null);
  
  const [message, setMessage] = useState("");
  
  const [saving, setSaving] = useState(false);
  
  const [savedPlans, setSavedPlans] = useState<any[]>([]);

  const [savedUsages, setSavedUsages] = useState<any[]>([]);

  const totalFreshwaterReplaced = savedUsages.reduce(
  (total, usage) => total + (Number(usage.freshwaterReplacedLitres) || 0),
  0
);

  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);



  const plan = useMemo(() => {

    let remaining = supply;

    return demands.map((demand) => {

      const allocated = demand.enabled

        ? Math.min(demand.litres, remaining)

        : 0;

      remaining -= allocated;

      return { ...demand, allocated };

    });

  }, [supply, demands]);



  const allocated = plan.reduce((sum, item) => sum + item.allocated, 0);



  function resetPlan() {

    setApproved(false);

    setSavedPlanId(null);

    setVerified(null);

    setMessage("");

  }



  function changeSupply(value: number) {

    setSupply(Math.max(0, Math.min(1000000, value)));

    resetPlan();

  }



  function changeDemand(id: number, value: number) {

    setDemands((old) =>

      old.map((item) =>

        item.id === id

          ? { ...item, litres: Math.max(0, Math.min(1000000, value)) }

          : item

      )

    );

    resetPlan();

  }



  function toggleDemand(id: number) {

    setDemands((old) =>

      old.map((item) =>

        item.id === id ? { ...item, enabled: !item.enabled } : item

      )

    );

    resetPlan();

  }



  async function approvePlan() {

    setSaving(true);

    setMessage("Saving allocation plan to AWS...");

    setVerified(null);



    try {

      const today = new Date().toISOString().slice(0, 10);



      const supplyResult = await client.models.Supply.create({

        buildingId: BUILDING_ID,

        date: today,

        availableLitres: supply,

        sourceLabel: "User-entered treated water",

        notes: "ReFlow demo input; not independently verified.",

      } as any);



      if (supplyResult.errors?.length || !supplyResult.data) {

        throw new Error(

          supplyResult.errors?.map((e) => e.message).join("; ") ||

            "Could not save supply."

        );

      }



      const planResult = await client.models.AllocationPlan.create({

        buildingId: BUILDING_ID,
        
        date: today,

        supplyLitres: supply,

        toiletFlushingLitres: plan.find((x) => x.id === 1)?.allocated ?? 0,

        landscapingLitres: plan.find((x) => x.id === 2)?.allocated ?? 0,

        cleaningLitres: plan.find((x) => x.id === 3)?.allocated ?? 0,

        recommendedReuseLitres: allocated,

        status: "APPROVED",

      } as any);



      if (planResult.errors?.length || !planResult.data) {

        throw new Error(

          planResult.errors?.map((e) => e.message).join("; ") ||

            "Could not save allocation plan."

        );

      }



      setSavedPlanId(planResult.data.id);
setApproved(true);
setActual("0");
setReplaced("0");
setMessage(
  `Plan saved to AWS successfully. Plan ID: ${planResult.data.id}`
);

await verifyAwsRecords();

    } catch (error) {

      console.error("AWS plan save failed:", error);

      setApproved(false);

      setSavedPlanId(null);

      setMessage(

        error instanceof Error

          ? `AWS save failed: ${error.message}`

          : "AWS save failed. Please try again."

      );

    } finally {

      setSaving(false);

    }

  }
    async function verifyAwsRecords() {
    setSaving(true);
    setMessage("Reading saved records from AWS...");

    try {
      const [plansResult, usageResult] = await Promise.all([
        client.models.AllocationPlan.list({ limit: 100 }),
        client.models.ActualUsage.list({ limit: 100 }),
      ]);

      if (plansResult.errors?.length || usageResult.errors?.length) {
        const errors = [
          ...(plansResult.errors ?? []),
          ...(usageResult.errors ?? []),
        ];
        throw new Error(errors.map((e) => e.message).join("; "));
      }

      const plans = plansResult.data ?? [];
      const usages = usageResult.data ?? [];

      setSavedPlans(
        [...plans].sort((a, b) => b.date.localeCompare(a.date))
      );

      setSavedUsages(
        [...usages].sort((a, b) => b.date.localeCompare(a.date))
      );

      setMessage(
        `AWS read-back successful. ${plans.length} plans and ${usages.length} usage records loaded.`
      );
    } catch (error) {
      console.error("AWS read-back failed:", error);
      setMessage(
        error instanceof Error
          ? `AWS read-back failed: ${error.message}`
          : "Could not read records from AWS."
      );
    } finally {
      setSaving(false);
    }
  }

  async function recordUsage() {

    if (!savedPlanId) {

      setMessage("Save an allocation plan before recording actual use.");

      return;

    }



    const used = Number(actual);

    const freshwater = Number(replaced);



    if (

      actual.trim() === "" ||

      !Number.isFinite(used) ||

      used < 0 ||

      used > allocated

    ) {

      setMessage(`Actual use must be between 0 and ${allocated} litres.`);

      return;

    }



    if (

      replaced.trim() === "" ||

      !Number.isFinite(freshwater) ||

      freshwater < 0 ||

      freshwater > used

    ) {

      setMessage("Freshwater replacement must be between 0 and actual use.");

      return;

    }



    setSaving(true);

    setMessage("Saving actual usage to AWS...");



    try {

      const result = await client.models.ActualUsage.create({

        buildingId: BUILDING_ID,
        
        date: new Date().toISOString().slice(0, 10),

        planId: savedPlanId,

        useType: "Combined non-potable uses",

        deliveredLitres: used,

        freshwaterReplacedLitres: freshwater,

        confirmed: true,

        notes: "User-entered demo record; not independently verified.",

      } as any);



      if (result.errors?.length || !result.data) {

        throw new Error(

          result.errors?.map((e) => e.message).join("; ") ||

            "Could not save actual usage."

        );

      }



      setVerified(freshwater);

      setMessage(

        `Actual usage saved to AWS. Record ID: ${result.data.id}. ` +

          "Entered data has not been independently verified."

      );

    } catch (error) {

      console.error("AWS usage save failed:", error);

      setMessage(

        error instanceof Error

          ? `AWS save failed: ${error.message}`

          : "AWS save failed. Please try again."

      );

    } finally {

      setSaving(false);

    }

  }



  return (

    <main className="shell">

      
<header className="topbar">
  <a className="brand" href="#top">
    <span className="logo">R</span>
    <span>
      ReFlow
      <small className="brand-subtitle">WATER REUSE PLANNER</small>
    </span>
  </a>

  <nav className="main-nav" aria-label="Main navigation">
    <a className="nav-link active" href="#top">⌂ <span>Home</span></a>
    <a className="nav-link" href="#planner">▦ <span>Plan</span></a>
    <a className="nav-link" href="#usage">▥ <span>Usage</span></a>
    <a className="nav-link" href="#records">▤ <span>Records</span></a>
    <a className="nav-link" href="#insights">↗ <span>Insights</span></a>
  </nav>

  <span className="tag">WATER REUSE</span>
</header>




      
<section className="hero hero-dynamic" id="top">
  <div className="hero-water" aria-hidden="true">
    <span className="water-orb orb-one" />
    <span className="water-orb orb-two" />
    <span className="water-orb orb-three" />
    <div className="water-ripple ripple-one" />
    <div className="water-ripple ripple-two" />
  </div>

  <div className="hero-content">
    <p className="eyebrow hero-reveal">
      <span className="eyebrow-dot" />
      GIVE EVERY DROP A SECOND JOB
    </p>

    <h1 className="hero-title hero-reveal">
      Waste less water.
      <br />
      <span>Make every litre count.</span>
    </h1>

    <p className="intro hero-reveal">
      Match available treated water to suitable non-drinking needs.
      Plan allocation, record actual use, and estimate freshwater replaced.
    </p>

    <a className="hero-cta hero-reveal" href="#planner">
      Explore your water plan <span aria-hidden="true">↘</span>
    </a>

    <p className="hero-footnote hero-reveal">
      PLAN SMARTER. REUSE RESPONSIBLY.
    </p>
  </div>

  <div className="hero-bottom-wave" aria-hidden="true">
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none">
      <path d="M0,70 C240,120 440,10 720,55 S1190,115 1440,35 L1440,120 L0,120 Z" />
    </svg>
  </div>
</section>
```

      <section className="stats" id="insights">

        <article className="stat highlight">

          <span>REUSE RECOMMENDED</span>

          <strong>{allocated.toLocaleString("en-IN")}</strong>

          <small>litres planned</small>

        </article>

        <article className="stat">

          <span>AVAILABLE SUPPLY</span>

          <strong>{supply.toLocaleString("en-IN")}</strong>

          <small>litres entered</small>

        </article>

        <article className="stat">

          <span>FRESHWATER REPLACED</span>

          <strong>{totalFreshwaterReplaced.toLocaleString("en-IN")}</strong>

          <small>litres entered as actual use</small>

        </article>

      </section>
      
<section className="quick-actions" aria-label="Dashboard shortcuts">
  <a className="action-card action-green" href="#planner">
    <span className="action-icon">▦</span>
    <span className="action-copy">
      <strong>Plan Allocation</strong>
      <small>Allocate treated water for toilets, landscaping and cleaning.</small>
    </span>
    <span className="action-arrow">›</span>
  </a>

  <a id="usage" className="action-card action-blue" href="#usage">
    <span className="action-icon">●</span>
    <span className="action-copy">
      <strong>Record Actual Use</strong>
      <small>Track how much treated water was actually used.</small>
    </span>
    <span className="action-arrow">›</span>
  </a>

  <a className="action-card action-purple" href="#records">
    <span className="action-icon">▥</span>
    <span className="action-copy">
      <strong>View Records</strong>
      <small>Review saved plans and actual usage history.</small>
    </span>
    <span className="action-arrow">›</span>
  </a>

  <a className="action-card action-leaf" href="#insights">
    <span className="action-icon">✳</span>
    <span className="action-copy">
      <strong>Sustainable Impact</strong>
      <small>Review the freshwater replacement recorded so far.</small>
    </span>
    <span className="action-arrow">›</span>
  </a>
</section>




      <section id="planner" className="section">

        <div className="heading">

          <div>

            <p className="eyebrow">01 / INPUT</p>

            <h2>Available treated water</h2>

          </div>

          <span className="tag">LITRES / DAY</span>

        </div>

        <article className="panel supply-panel">

          <label htmlFor="supply">Volume available for reuse</label>

          <div className="supply-control">

            <input

              id="supply"

              type="number"

              min="0"

              max="1000000"

              value={supply}

              onChange={(e) => changeSupply(Number(e.target.value) || 0)}

            />

            <span>litres</span>

          </div>

          <input

            className="slider"

            type="range"

            aria-label="Adjust treated water supply"

            min="0"

            max="10000"

            step="250"

            value={Math.min(supply, 10000)}

            onChange={(e) => changeSupply(Number(e.target.value))}

          />

          <div className="range-labels">

            <span>0 L</span><span>10,000 L</span>

          </div>

        </article>

      </section>



      <section className="section">

        <div className="heading">

          <div>

            <p className="eyebrow">02 / MATCH</p>

            <h2>Eligible reuse needs</h2>

          </div>

          <span className="tag">EDIT DEMAND</span>

        </div>

        <div className="demand-list">

          {plan.map((item) => (

            <article className="panel demand" key={item.id}>

              <div className="demand-top">

                <div>

                  <h3>{item.name}</h3>

                  <p>Illustrative demand · Check water-quality suitability</p>

                </div>

                <label className="switch">

                  <input

                    type="checkbox"

                    checked={item.enabled}

                    onChange={() => toggleDemand(item.id)}

                    aria-label={`Include ${item.name}`}

                  />

                  <span />

                </label>

              </div>

              <div className="demand-bottom">

                <label htmlFor={`demand-${item.id}`}>Required litres</label>

                <input

                  id={`demand-${item.id}`}

                  type="number"

                  min="0"

                  max="1000000"

                  disabled={!item.enabled}

                  value={item.litres}

                  onChange={(e) =>

                    changeDemand(item.id, Number(e.target.value) || 0)

                  }

                />

                <div className="allocation">

                  <span>ALLOCATED</span>

                  <strong>{item.allocated.toLocaleString("en-IN")} L</strong>

                </div>

              </div>

              <div className="bar">

                <div

                  style={{

                    width: `${

                      item.enabled && item.litres > 0

                        ? Math.min(100, (item.allocated / item.litres) * 100)

                        : 0

                    }%`,

                  }}

                />

              </div>

              <p className="allocation-note">

                {item.allocated === item.litres && item.enabled

                  ? "Full demand matched"

                  : item.allocated > 0

                    ? `${(item.litres - item.allocated).toLocaleString("en-IN")} L demand unmet`

                    : "No water allocated"}

              </p>

            </article>

          ))}

        </div>

      </section>



      <section className="panel summary">

        <p className="eyebrow">03 / APPROVE</p>

        <h2>Allocation summary</h2>

        <div className="summary-row">

          <span>Total recommended reuse</span>

          <strong>{allocated.toLocaleString("en-IN")} L</strong>

        </div>

        <div className="summary-row">

          <span>Unallocated supply</span>

          <strong>{(supply - allocated).toLocaleString("en-IN")} L</strong>

        </div>

        <button className="button" disabled={saving} onClick={approvePlan}>

          {saving ? "Saving..." : "Approve and save plan →"}

        </button>

        {approved && (

          <p className="success">

            Plan saved. You can now record actual usage.

          </p>

        )}

      </section>



      <section className="section">

        <div className="heading">

          <div>

            <p className="eyebrow">04 / RECORD</p>

            <h2>What actually happened?</h2>

          </div>

        </div>

        <article className="panel">

          <p className="help">

            Record freshwater replacement only when treated water was actually

            used instead of freshwater. Entered values are not independently

            verified.

          </p>

          <div className="record-grid">

            <label>

              Actual treated water used (L)

              <input

                type="number"

                min="0"

                max={allocated}

                value={actual}

                disabled={!approved || saving}

                onChange={(e) => {

                  setActual(e.target.value);

                  setVerified(null);

                  setMessage("");

                }}

              />

            </label>

            <label>

              Freshwater replaced (L)

              <input

                type="number"

                min="0"

                max={actual || 0}

                value={replaced}

                disabled={!approved || saving}

                onChange={(e) => {

                  setReplaced(e.target.value);

                  setVerified(null);

                  setMessage("");

                }}

              />

            </label>

          </div>

          <button

            className="button"

            disabled={!approved || saving}

            onClick={recordUsage}

          >

            {saving ? "Saving..." : "Save actual use to AWS"}

          </button>

                    <button
            className="button"
            disabled={saving}
            onClick={verifyAwsRecords}
            style={{ marginTop: 12 }}
          >
            {saving ? "Checking..." : "Verify saved records"}
          </button>

          {message && <p className="message" role="status">{message}</p>}

          <div id="records" className="saved-records">
  <h3>Saved allocation plans</h3>

  {savedPlans.length === 0 ? (
    <p>No allocation plans loaded. Click Verify saved records.</p>
  ) : (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Record ID</th>
            <th>Date</th>
            <th>Supply (L)</th>
            <th>Toilet (L)</th>
            <th>Landscaping (L)</th>
            <th>Cleaning (L)</th>
            <th>Recommended reuse (L)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {savedPlans.map((item) => (
            <tr key={item.id}>
              <td title={item.id}>
                {item.id ? item.id.slice(0, 8) : "—"}</td>
              <td>{item.date}</td>
              <td>{item.supplyLitres.toLocaleString()}</td>
              <td>{item.toiletFlushingLitres.toLocaleString()}</td>
              <td>{item.landscapingLitres.toLocaleString()}</td>
              <td>{item.cleaningLitres.toLocaleString()}</td>
              <td>{item.recommendedReuseLitres.toLocaleString()}</td>
              <td>{item.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}

  <h3>Saved actual usage</h3>

  {savedUsages.length === 0 ? (
    <p>No usage records loaded. Click Verify saved records.</p>
  ) : (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Record ID</th>
            <th>Date</th>
            <th>Use type</th>
            <th>Treated water used (L)</th>
            <th>Freshwater replaced (L)</th>
            <th>Confirmed</th>
          </tr>
        </thead>
        <tbody>
          {savedUsages.map((item) => (
            <tr key={item.id}>
              <td title={item.id}>
              {item.id ? item.id.slice(0, 8) : "—"}</td>
              <td>{item.date}</td>
              <td>{item.useType}</td>
              <td>{item.deliveredLitres.toLocaleString()}</td>
              <td>{item.freshwaterReplacedLitres.toLocaleString()}</td>
              <td>{item.confirmed ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
          {verified !== null && (

            <p className="success">

              {verified.toLocaleString("en-IN")} L entered as freshwater

              replaced.

            </p>

          )}

        </article>

      </section>

            <UsageChart />



      <footer>


        <strong>ReFlow</strong>
          <center>

        <p>

          Demo values are illustrative. Real use requires suitable water

          quality, safe plumbing and accurate delivery records. AWS saves

          user-entered records; they are not independently verified.

        </p>
          </center>

      </footer>

    </main>

  );

}




export default function AuthenticatedApp() {
  const [displayName, setDisplayName] = useState("");

  return (
    <Authenticator>
      {({ signOut }) => (
        <div>
          <div className="account-bar">
            <form
              className="account-name-form"
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem(
                  "displayName"
                ) as HTMLInputElement;

                if (input.value.trim()) {
                  setDisplayName(input.value.trim());
                }
              }}
            >
              {displayName ? (
                <span className="account-name">
                  Welcome, {displayName}
                </span>
              ) : (
                <>
                  <input
                    name="displayName"
                    type="text"
                    placeholder="Enter your name"
                    aria-label="Your name"
                    required
                    maxLength={60}
                  />
                  <button type="submit" className="save-name-button">
                    Save name
                  </button>
                </>
              )}
            </form>

            <button
              className="signout-button"
              onClick={() => signOut?.()}
            >
              <span aria-hidden="true">↗</span>
              Sign out
            </button>
          </div>

          <Planner />
        </div>
      )}
    </Authenticator>
  );
}
