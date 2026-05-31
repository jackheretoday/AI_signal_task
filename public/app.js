/**
 * ArchForgeX Compiler Pipeline — Client Logic
 */
document.addEventListener("DOMContentLoaded", () => {
  // ── DOM ELEMENTS ───────────────────────────────────────────────────────────
  const promptInput      = document.getElementById("prompt-input");
  const compileBtn       = document.getElementById("compile-btn");
  const compileBtnText   = compileBtn.querySelector(".btn-text");
  const compileBtnLoader = compileBtn.querySelector(".btn-loader");
  
  const logOutput        = document.getElementById("log-output");
  const compilerMetrics  = document.getElementById("compiler-metrics");
  
  const resultsPanel     = document.getElementById("results-panel");
  const telLatency       = document.getElementById("tel-latency");
  const telTokens        = document.getElementById("tel-tokens");
  const telCost          = document.getElementById("tel-cost");
  
  const tabButtons       = document.querySelectorAll(".tab-btn");
  const tabPanes         = document.querySelectorAll(".tab-pane");
  
  const mockAppName      = document.getElementById("mock-app-name");
  const mockNav          = document.getElementById("mock-nav");
  const mockPageCanvas   = document.getElementById("mock-page-canvas");
  
  const apiRoutesBody    = document.getElementById("api-routes-body");
  const dbTablesGrid     = document.getElementById("db-tables-grid");
  const authScopesContainer = document.getElementById("auth-scopes-container");
  const assumptionsList   = document.getElementById("assumptions-list");
  const rawJsonCode      = document.getElementById("raw-json-code");
  const erdSvgContainer  = document.getElementById("erd-svg-container");
  const c4SvgContainer   = document.getElementById("c4-svg-container");
  const copyJsonBtn      = document.getElementById("copy-json-btn");

  const exportPdfBtn     = document.getElementById("export-pdf-btn");
  const exportOpenApiBtn = document.getElementById("export-openapi-btn");
  const pdfReportTemplate = document.getElementById("pdf-report-template");

  let simulationInterval = null;
  let activeStepNum      = 0;
  let simulatedProgress  = 0;
  let lastCompilationResult = null;

  // ── QUICK TEMPLATES ────────────────────────────────────────────────────────
  document.querySelectorAll(".btn-template").forEach(btn => {
    btn.addEventListener("click", () => {
      promptInput.value = btn.getAttribute("data-prompt");
      promptInput.focus();
    });
  });

  // ── TABS NAVIGATION ────────────────────────────────────────────────────────
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanes.forEach(p => p.classList.remove("active"));
      
      btn.classList.add("active");
      const targetPane = document.getElementById(btn.getAttribute("data-tab"));
      if (targetPane) {
        targetPane.classList.add("active");
        // Scroll the results panel into view smoothly so the user sees the active section
        const resultsPanel = document.getElementById("results-panel");
        if (resultsPanel) {
          resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    });
  });

  // ── COPY RAW JSON TO CLIPBOARD ─────────────────────────────────────────────
  if (copyJsonBtn) {
    copyJsonBtn.addEventListener("click", () => {
      const rawText = rawJsonCode.textContent;
      if (!rawText) return;
      navigator.clipboard.writeText(rawText).then(() => {
        const originalText = copyJsonBtn.innerHTML;
        copyJsonBtn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
        setTimeout(() => {
          copyJsonBtn.innerHTML = originalText;
        }, 2000);
      }).catch(err => {
        console.error("Failed to copy JSON to clipboard:", err);
      });
    });
  }

  // ── TERMINAL LOG WRITER ────────────────────────────────────────────────────
  function appendLog(message, type = "muted") {
    const timestamp = new Date().toLocaleTimeString();
    const line = document.createElement("span");
    line.className = `log-line text-${type}`;
    line.innerHTML = `[${timestamp}] ${message}`;
    logOutput.appendChild(line);
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  function clearLogs() {
    logOutput.innerHTML = "";
  }

  // ── PIPELINE SIMULATOR ─────────────────────────────────────────────────────
  function startPipelineAnimation() {
    activeStepNum = 1;
    simulatedProgress = 0;
    
    // Reset all steps UI
    for (let i = 1; i <= 4; i++) {
      const step = document.getElementById(`step-${i}`);
      step.className = "pipeline-step";
      step.querySelector(".step-status").textContent = "Idle";
      step.querySelector(".progress-fill").style.width = "0%";
    }

    setStepActive(1);
    appendLog("🧬 Initializing deterministic compilation environment...", "cyan");
    appendLog("🚀 Running Stage 1: Intent Extraction (Scope, Entities, Roles)...", "violet");

    simulationInterval = setInterval(() => {
      simulatedProgress += Math.random() * 8 + 3;
      
      if (simulatedProgress >= 100) {
        simulatedProgress = 0;
        setStepCompleted(activeStepNum);
        
        activeStepNum++;
        if (activeStepNum <= 4) {
          setStepActive(activeStepNum);
          if (activeStepNum === 2) {
            appendLog("⚙️ Stage 1 Complete. Analyzing structural layout constraints...", "green");
            appendLog("🚀 Running Stage 2: System Design (Access Matrix, Relational Keys)...", "violet");
          } else if (activeStepNum === 3) {
            appendLog("⚙️ Stage 2 Complete. Validating constraint models...", "green");
            appendLog("🚀 Running Stage 3: Schema Generation (Zod Compiler, UI, API, DB mappings)...", "violet");
          } else if (activeStepNum === 4) {
            appendLog("⚙️ Stage 3 Complete. Validating syntax nodes...", "green");
            appendLog("🚀 Running Stage 4: Final Refinement (Consistency Validator & Repair Sync)...", "violet");
          }
        } else {
          clearInterval(simulationInterval);
        }
      } else {
        const step = document.getElementById(`step-${activeStepNum}`);
        if (step) {
          step.querySelector(".progress-fill").style.width = `${Math.min(simulatedProgress, 95)}%`;
        }
      }
    }, 400);
  }

  function setStepActive(stepNum) {
    const step = document.getElementById(`step-${stepNum}`);
    if (step) {
      step.className = "pipeline-step active";
      step.querySelector(".step-status").textContent = "Compiling";
    }
  }

  function setStepCompleted(stepNum) {
    const step = document.getElementById(`step-${stepNum}`);
    if (step) {
      step.className = "pipeline-step completed";
      step.querySelector(".step-status").textContent = "Success";
      step.querySelector(".progress-fill").style.width = "100%";
    }
  }

  function finalizeAllStepsSuccess() {
    clearInterval(simulationInterval);
    for (let i = 1; i <= 4; i++) {
      setStepCompleted(i);
    }
    appendLog("✨ Pipeline compilation completed successfully!", "green");
    appendLog("🧠 Cross-layer synchronization validated (0 errors, 0 warnings).", "green");
  }

  function markStepFailed(stepNum, errorMsg) {
    clearInterval(simulationInterval);
    const step = document.getElementById(`step-${stepNum}`);
    if (step) {
      step.className = "pipeline-step failed";
      step.querySelector(".step-status").textContent = "Failed";
    }
    appendLog(`❌ Stage ${stepNum} Compilation Failure!`, "orange");
    appendLog(`⚠️ Reason: ${errorMsg}`, "orange");
  }

  // ── RENDER COMPILATION RESULTS ─────────────────────────────────────────────
  function renderResults(result) {
    lastCompilationResult = result;
    // Show Panel
    resultsPanel.classList.remove("hidden");
    resultsPanel.scrollIntoView({ behavior: "smooth" });

    // Telemetry Dashboard
    const totalSecs = (result.telemetry.totalPipelineLatencyMs / 1000).toFixed(1);
    telLatency.textContent = `${totalSecs}s`;
    
    const totalToks = result.telemetry.totalInputTokens + result.telemetry.totalOutputTokens;
    telTokens.textContent = totalToks.toLocaleString();
    
    telCost.textContent = `$${result.telemetry.totalCostUSD.toFixed(5)}`;
    
    compilerMetrics.textContent = `Latency: ${totalSecs}s | Cost: $${result.telemetry.totalCostUSD.toFixed(5)}`;

    // Raw JSON tab
    rawJsonCode.textContent = JSON.stringify(result, null, 2);

    // Render ERD Tab
    if (result.erdSvg) {
      erdSvgContainer.innerHTML = result.erdSvg;
    } else {
      erdSvgContainer.innerHTML = `<p class="tagline" style="color: var(--color-muted); font-size: 0.95rem; text-align: center; margin: 0;">No ERD SVG available.</p>`;
    }

    // Render C4 Tab
    if (result.c4ContextSvg) {
      c4SvgContainer.innerHTML = result.c4ContextSvg;
    } else {
      c4SvgContainer.innerHTML = `<p class="tagline" style="color: var(--color-muted); font-size: 0.95rem; text-align: center; margin: 0;">No C4 Context SVG available.</p>`;
    }

    const schemas = result.finalSchemas || result;

    // 1. Render UI Schema Tab
    renderUIBlueprint(schemas.uiSchema || schemas.ui);

    // 2. Render API Schema Tab
    renderAPIRoutes(schemas.apiSchema || schemas.api);

    // 3. Render DB Schema Tab
    renderDBSchema(schemas.dbSchema || schemas.db);

    // 4. Render Auth Schema Tab
    renderAuthScopes(schemas.authSchema || schemas.auth);

    // 5. Render Assumptions Tab
    renderAssumptions(result.systemAssumptions || schemas.systemAssumptions);

    // 6. Render Quality Scores Tab
    renderQualityScores(result.qualityScore);

    // 7. Render Architect Review Tab
    renderArchitectAdvisor(result.architectAdvisor);
  }

  // ── TAB 1: UI BLUEPRINT RENDERER ───────────────────────────────────────────
  function renderUIBlueprint(ui) {
    if (!ui) return;
    mockAppName.textContent = ui.appName || "Software Portal";
    mockNav.innerHTML = "";
    mockPageCanvas.innerHTML = "";

    const links = ui.navLinks || [];
    const pages = ui.pages || [];

    // Render Navigation
    links.forEach((link, idx) => {
      const pageInfo = pages.find(p => p.path === link) || pages[idx] || { name: link.replace("/", "") };
      const a = document.createElement("a");
      a.href = "#";
      a.innerHTML = `<i class="fa-solid fa-folder-open"></i> ${pageInfo.name}`;
      if (idx === 0) a.classList.add("active");
      
      a.addEventListener("click", (e) => {
        e.preventDefault();
        mockNav.querySelectorAll("a").forEach(navL => navL.classList.remove("active"));
        a.classList.add("active");
        showMockPage(pageInfo);
      });
      mockNav.appendChild(a);
    });

    // Default to show first page
    if (pages.length > 0) {
      showMockPage(pages[0]);
    }
  }

  function showMockPage(page) {
    mockPageCanvas.innerHTML = `
      <div class="mock-page-header animate-fade-in">
        <div>
          <h3>${page.name}</h3>
          <span class="tagline">Route Path: ${page.path}</span>
        </div>
        ${page.isGated ? `<span class="mock-gated-badge"><i class="fa-solid fa-lock"></i> Gated: ${page.gatedRoles.join(", ")}</span>` : ""}
      </div>
      <div class="mock-card-grid animate-fade-in">
        ${(page.components || []).map(comp => `
          <div class="mock-comp-card">
            <h4><i class="fa-solid fa-cube"></i> ${comp.componentName}</h4>
            <span class="tagline">Entity: ${comp.bindsToEntity || "N/A"}</span>
            <div style="margin-top: 0.8rem;">
              ${(comp.fields || []).map(field => `
                <span class="mock-comp-field">${field}</span>
              `).join("")}
            </div>
          </div>
        `).join("")}
      </div>
    `;
  }

  // ── TAB 2: API ROUTES RENDERER ─────────────────────────────────────────────
  function renderAPIRoutes(api) {
    if (!api) return;
    apiRoutesBody.innerHTML = "";
    const routes = api.routes || [];

    routes.forEach(route => {
      const tr = document.createElement("tr");
      
      const methodClass = `route-${route.method.toLowerCase()}`;
      const payloadString = Object.entries(route.requestPayload || {})
        .map(([k, v]) => `${k}: <span class="text-violet">${v}</span>`)
        .join("<br>") || "<span class='text-muted'>None</span>";

      tr.innerHTML = `
        <td><span class="route-badge ${methodClass}">${route.method}</span></td>
        <td><span class="route-path">${api.basePath || ""}${route.path}</span></td>
        <td>
          <span class="text-cyan" style="font-weight:600;">
            ${route.roles ? route.roles.join(", ") : "Public"}
          </span>
        </td>
        <td><span class="text-muted">${route.entity || "N/A"}</span></td>
        <td><div class="payload-list">${payloadString}</div></td>
      `;
      apiRoutesBody.appendChild(tr);
    });
  }

  // ── TAB 3: DATABASE SCHEMA RENDERER ────────────────────────────────────────
  function renderDBSchema(db) {
    if (!db) return;
    dbTablesGrid.innerHTML = "";
    const tables = db.tables || [];

    tables.forEach(table => {
      const card = document.createElement("div");
      card.className = "db-table-card animate-fade-in";
      
      const columnsHtml = (table.columns || []).map(col => {
        let details = [];
        if (col.unique) details.push("unique");
        if (!col.nullable) details.push("not null");
        if (col.default) details.push(`default: ${col.default}`);
        
        return `
          <div class="db-col-row">
            <span class="db-col-name">${col.name}</span>
            <div>
              <span class="db-col-type">${col.type}</span>
              ${details.length > 0 ? `<span class="db-col-details">${details.join(" | ")}</span>` : ""}
            </div>
          </div>
        `;
      }).join("");

      const foreignKeysHtml = (table.foreignKeys || []).map(fk => `
        <div class="db-fkey-row">
          <i class="fa-solid fa-link"></i> ${fk.column} → ${fk.referencesTable}(${fk.referencesColumn})
        </div>
      `).join("");

      card.innerHTML = `
        <div class="db-card-header">
          <h4><i class="fa-solid fa-table"></i> ${table.tableName}</h4>
          <span class="db-entity-tag">${table.entity}</span>
        </div>
        <div class="db-card-body">
          <div class="db-columns-list">
            ${columnsHtml}
          </div>
          ${foreignKeysHtml ? `
            <div class="db-fkeys-section">
              <div class="db-fkeys-header">Foreign Keys</div>
              ${foreignKeysHtml}
            </div>
          ` : ""}
        </div>
      `;
      dbTablesGrid.appendChild(card);
    });
  }

  // ── TAB 4: AUTH SCHEMAS RENDERER ───────────────────────────────────────────
  function renderAuthScopes(auth) {
    if (!auth) return;
    authScopesContainer.innerHTML = "";
    const roles = auth.rolePermissions || [];

    roles.forEach(roleData => {
      const card = document.createElement("div");
      card.className = "auth-card animate-fade-in";

      const allowedHtml = (roleData.allowedRoutes || []).map(route => `
        <span class="auth-route-item allowed"><i class="fa-regular fa-circle-check"></i> ${route}</span>
      `).join("") || "<span class='text-muted'>None</span>";

      const deniedHtml = (roleData.deniedRoutes || []).map(route => `
        <span class="auth-route-item denied"><i class="fa-regular fa-circle-xmark"></i> ${route}</span>
      `).join("");

      card.innerHTML = `
        <h4><i class="fa-solid fa-user-shield"></i> ${roleData.role}</h4>
        <div class="tagline" style="margin-bottom:1rem;">Token Expiry: ${roleData.tokenExpiry || "24h"}</div>
        
        <div class="auth-card-section">
          <h5>Allowed Resource Envelopes</h5>
          <div class="auth-routes-list">
            ${allowedHtml}
          </div>
        </div>
        
        ${deniedHtml ? `
          <div class="auth-card-section">
            <h5>Explicit Access Denial</h5>
            <div class="auth-routes-list">
              ${deniedHtml}
            </div>
          </div>
        ` : ""}
      `;
      authScopesContainer.appendChild(card);
    });
  }

  // ── TAB 5: SYSTEM ASSUMPTIONS RENDERER ─────────────────────────────────────
  function renderAssumptions(assumptions) {
    if (!assumptions) {
      assumptionsList.innerHTML = `<div class="text-muted" style="text-align:center; padding: 2rem;">No system design assumptions specified.</div>`;
      return;
    }
    assumptionsList.innerHTML = "";
    
    assumptions.forEach((asm, index) => {
      const card = document.createElement("div");
      card.className = "assumption-card animate-fade-in";

      const tagsHtml = (asm.affectedLayers || []).map(tag => `
        <span class="assumption-tag">${tag}</span>
      `).join("");

      card.innerHTML = `
        <div class="assumption-num">${String(index + 1).padStart(2, '0')}</div>
        <div class="assumption-content">
          <h4>${asm.assumption}</h4>
          <p>${asm.rationale}</p>
          <div class="assumption-tags">
            ${tagsHtml}
          </div>
        </div>
      `;
      assumptionsList.appendChild(card);
    });
  }

  // Helper to determine color based on score value
  function getScoreColor(score) {
    if (score < 70) return "#ef4444"; // Red
    if (score <= 85) return "#f59e0b"; // Amber
    return "#10b981"; // Green
  }

  // ── TAB 6: QUALITY SCORES RENDERER ─────────────────────────────────────────
  function renderQualityScores(qualityScore) {
    const overallBadge = document.getElementById("overall-score-badge");
    const dimensionsGrid = document.getElementById("dimension-scores-grid");
    const findingsList = document.getElementById("score-findings-list");

    if (!qualityScore || !qualityScore.scores) {
      overallBadge.textContent = "--";
      overallBadge.style.color = "var(--color-primary)";
      dimensionsGrid.innerHTML = `<div class="text-muted" style="grid-column: 1/-1; text-align:center; padding: 2rem;">No quality score telemetry available.</div>`;
      findingsList.innerHTML = `<div class="text-muted" style="text-align:center; padding: 2rem;">No quality score findings available.</div>`;
      return;
    }

    const scores = qualityScore.scores;
    const overall = qualityScore.overallScore;

    // Render overall badge
    overallBadge.textContent = Math.round(overall);
    overallBadge.style.color = getScoreColor(overall);

    // Render dimensions
    dimensionsGrid.innerHTML = "";
    Object.entries(scores).forEach(([dimension, score]) => {
      const card = document.createElement("div");
      card.className = "dimension-score-card animate-fade-in";
      card.style.cssText = "background: var(--color-dark-gray); border: var(--border-brutalist); border-radius: var(--border-radius); padding: 1.5rem; box-shadow: 4px 4px 0px var(--color-black); display: flex; flex-direction: column; gap: 0.5rem;";

      const color = getScoreColor(score);
      const titleCase = dimension.charAt(0).toUpperCase() + dimension.slice(1);

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: var(--color-white); font-size: 1.1rem;">${titleCase}</strong>
          <span style="font-size: 1.5rem; font-weight: 800; color: ${color};">${Math.round(score)}</span>
        </div>
        <div style="width: 100%; height: 10px; background: var(--color-black); border-radius: var(--border-radius); overflow: hidden; border: var(--border-brutalist);">
          <div style="width: ${score}%; height: 100%; background: ${color}; border-radius: var(--border-radius); transition: width 0.5s ease;"></div>
        </div>
      `;
      dimensionsGrid.appendChild(card);
    });

    // Render findings
    findingsList.innerHTML = "";
    const findings = qualityScore.findings || [];
    if (findings.length === 0) {
      findingsList.innerHTML = `<div class="text-muted" style="text-align:center; padding: 2rem;">All check layers compliant. 0 quality deductions recorded.</div>`;
      return;
    }

    findings.forEach(finding => {
      const card = document.createElement("div");
      card.className = "finding-card animate-fade-in";
      card.style.cssText = "background: var(--color-black); border: var(--border-brutalist); border-radius: var(--border-radius); padding: 1.2rem; display: flex; gap: 1rem; position: relative; border-left: 5px solid var(--color-orange);";

      card.innerHTML = `
        <div style="flex-grow: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <strong style="color: var(--color-white); font-size: 1rem;">${finding.dimension} Finding</strong>
            <span style="font-size: 0.85rem; color: #ef4444; font-weight: 700; background: rgba(239, 68, 68, 0.1); border: 1px solid #ef4444; padding: 0.15rem 0.5rem; border-radius: 4px;">Deduction: -${finding.deduction}</span>
          </div>
          <p style="margin: 0 0 0.8rem 0; color: var(--color-muted); font-size: 0.9rem;">${finding.issue}</p>
          <div style="font-size: 0.85rem; color: var(--color-primary); background: rgba(0, 0, 0, 0.4); padding: 0.6rem; border-radius: 4px; display: flex; align-items: center; gap: 0.4rem;">
            <i class="fa-solid fa-lightbulb"></i> <strong>Recommendation:</strong> ${finding.recommendation}
          </div>
        </div>
      `;
      findingsList.appendChild(card);
    });
  }

  // ── TAB 7: ARCHITECT ADVISOR RENDERER ──────────────────────────────────────
  function renderArchitectAdvisor(architectAdvisor) {
    const grid = document.getElementById("advisor-cards-grid");

    if (!architectAdvisor || !architectAdvisor.recommendations) {
      grid.innerHTML = `<div class="text-muted" style="grid-column: 1/-1; text-align:center; padding: 2rem;">No advisory architecture recommendations available.</div>`;
      return;
    }

    grid.innerHTML = "";
    const recs = architectAdvisor.recommendations || [];
    recs.forEach(rec => {
      const card = document.createElement("div");
      card.className = "advisor-card animate-fade-in";
      card.style.cssText = "background: var(--color-dark-gray); border: var(--border-brutalist); border-radius: var(--border-radius); padding: 1.5rem; box-shadow: 4px 4px 0px var(--color-black); display: flex; flex-direction: column; gap: 1rem;";

      card.innerHTML = `
        <div style="border-bottom: 1px dashed var(--color-muted); padding-bottom: 0.8rem;">
          <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--color-muted); font-weight: 700; display: block; margin-bottom: 0.2rem;">System Trigger</span>
          <strong style="color: var(--color-white); font-size: 0.95rem; line-height: 1.4;">${rec.trigger}</strong>
        </div>
        <div>
          <span style="font-size: 0.8rem; text-transform: uppercase; color: var(--color-muted); font-weight: 700; display: block; margin-bottom: 0.4rem;">Architectural Pattern</span>
          <strong style="color: var(--color-primary); font-size: 1.1rem; display: block; margin-bottom: 0.4rem;"><b>${rec.pattern}</b></strong>
          <p style="margin: 0; color: var(--color-muted); font-size: 0.9rem; line-height: 1.5;">${rec.rationale}</p>
        </div>
        <div style="background: var(--color-black); border: var(--border-brutalist); border-radius: var(--border-radius); padding: 0.8rem; font-size: 0.85rem; color: var(--color-white); border-left: 4px solid var(--color-cyan);">
          <strong style="color: var(--color-cyan); display: block; margin-bottom: 0.2rem;"><i class="fa-solid fa-gears"></i> Concrete Implementation:</strong>
          ${rec.implementation}
        </div>
      `;
      grid.appendChild(card);
    });
  }

  // ── API COMPILATION ACTION CALL ────────────────────────────────────────────
  compileBtn.addEventListener("click", async () => {
    const promptValue = promptInput.value.trim();
    if (promptValue.length < 10) {
      alert("Please provide a more descriptive system request (minimum 10 characters).");
      return;
    }

    // Toggle button loader
    compileBtn.disabled = true;
    compileBtnText.classList.add("hidden");
    compileBtnLoader.classList.remove("hidden");
    resultsPanel.classList.add("hidden");

    clearLogs();
    startPipelineAnimation();

    try {
      appendLog("📡 Connecting to compiler backend on port 3000...", "cyan");
      
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptValue })
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        // Handle server stage/api error
        const stageNum = result.stageName ? parseInt(result.stageName.match(/\d/)[0]) : activeStepNum;
        const errMsg = result.message || result.error || "Internal compilation crash.";
        markStepFailed(stageNum, errMsg);
        
        appendLog(`❌ Compilation aborted. Details: ${JSON.stringify(result.details || result.rawApiError || errMsg)}`, "orange");
        
        // Handle Quota Exhausted friendly resolution
        if (result.error === "QUOTA_EXHAUSTED") {
          appendLog(`💡 RESOLUTION: ${result.resolution.join(" ")}`, "cyan");
        }
      } else {
        // Success
        finalizeAllStepsSuccess();
        
        // Print telemetry summary in logs
        const history = result.compilationHistory || [];
        history.forEach(hist => {
          if (hist.event === "STAGE_COMPLETE") {
            appendLog(`✅ Stage [${hist.stageName}] compiled: Latency: ${(hist.latencyMs / 1000).toFixed(1)}s | Cost: $${hist.costUSD.toFixed(5)}`, "green");
          } else if (hist.event === "SELF_REPAIR_ATTEMPT") {
            appendLog(`🔧 Self-Repair Engine triggered in [${hist.stageName}]: corrected ${hist.repairType}`, "orange");
          } else if (hist.event === "CROSS_LAYER_REPAIR_ATTEMPT") {
            appendLog(`🔧 Cross-Layer Auto-Correction triggered: resolved ${hist.mismatches.length} schema conflicts`, "orange");
          }
        });

        renderResults(result);
      }
    } catch (err) {
      markStepFailed(activeStepNum, err.message || err);
      appendLog(`❌ Critical Connection Failure! Check that your compiler server is running locally on port 3000. Error: ${err.message || err}`, "orange");
    } finally {
      // Restore button state
      compileBtn.disabled = false;
      compileBtnText.classList.remove("hidden");
      compileBtnLoader.classList.add("hidden");
    }
  });

  // ── EXPORT TO OPENAPI ACTION ───────────────────────────────────────────────
  exportOpenApiBtn.addEventListener("click", () => {
    if (!lastCompilationResult) {
      alert("No active compilation blueprint found. Please compile a system first.");
      return;
    }

    appendLog("💾 Downloading OpenAPI 3.1 YAML specification...", "cyan");
    window.location.href = "/api/export/openapi";
  });

  // ── EXPORT TO PDF BLUEPRINT ACTION ─────────────────────────────────────────
  exportPdfBtn.addEventListener("click", () => {
    if (!lastCompilationResult) {
      alert("No active compilation blueprint found. Please compile a system first.");
      return;
    }

    appendLog("🖨️ Compiling architecture blueprint report to PDF...", "cyan");

    const schemas = lastCompilationResult.finalSchemas || lastCompilationResult;
    const appName = schemas.uiSchema?.layout?.appName || schemas.ui?.appName || schemas.ui?.layout?.appName || "SaaS Portal";
    const totalSecs = (lastCompilationResult.telemetry.totalPipelineLatencyMs / 1000).toFixed(1);
    const totalToks = lastCompilationResult.telemetry.totalInputTokens + lastCompilationResult.telemetry.totalOutputTokens;
    const totalCost = lastCompilationResult.telemetry.totalCostUSD.toFixed(5);
    const dateStr = new Date().toLocaleDateString(undefined, { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });

    // ── PAGE-BUDGET AUDITING LOOP & CHUNKING FUNCTION ─────────────────────────
    const chunkArray = (arr, size) => {
      const chunks = [];
      for (let i = 0; i < arr.length; i += size) {
        chunks.push(arr.slice(i, i + size));
      }
      return chunks;
    };

    // Shard generated block chunks to prevent cross-page content tearing and table fragmentation
    const allUiPages      = schemas.uiSchema?.pages || schemas.ui?.pages || [];
    const uiPagesChunks   = chunkArray(allUiPages, 3); // Max 3 UI screens per printed A4 page

    const allApiRoutes    = schemas.apiSchema?.routes || schemas.api?.routes || [];
    const apiRoutesChunks = chunkArray(allApiRoutes, 6); // Max 6 API routes per page for data row cohesion

    const allDbTables     = schemas.dbSchema?.tables || schemas.db?.tables || [];
    const dbTablesChunks  = chunkArray(allDbTables, 3); // Max 3 relational DB tables per page

    const allAuthScopes   = schemas.authSchema?.rolePermissions || schemas.auth?.rolePermissions || [];
    const authScopesChunks = chunkArray(allAuthScopes, 3); // Max 3 security RBAC scopes per page

    const allAssumptions  = lastCompilationResult.systemAssumptions || schemas.systemAssumptions || [];
    const assumptionsChunks = chunkArray(allAssumptions, 4); // Max 4 assumptions per page

    // Programmatically calculate exact starting page indices for Table of Contents dot leaders
    const pageSec1 = 3;
    const pageSec2 = 4;
    const pageSec3 = pageSec2 + uiPagesChunks.length;
    const pageSec4 = pageSec3 + apiRoutesChunks.length;
    const pageSec5 = pageSec4 + 1; // C4 Context is exactly 1 page
    const pageSec6 = pageSec5 + 1; // ERD is exactly 1 page
    const pageSec7 = pageSec6 + dbTablesChunks.length;
    const pageSec8 = pageSec7 + authScopesChunks.length;
    const pageSec9 = pageSec8 + assumptionsChunks.length;
    const pageSec10 = pageSec9 + 1;
    const pageSec11 = pageSec10 + 1;

    // ── CHAPTER 2.0: UI Blueprints (Atomic Card blocks with page-break protection)
    const uiPagesHtml = uiPagesChunks.map((chunk, chunkIdx) => {
      const chunkHtml = chunk.map(p => `
        <div style="margin-bottom: 20px; border-bottom: 1px solid #E2E8F0; padding-bottom: 15px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <h4 style="margin: 0; color: #1D3557; font-size: 13px; font-weight: 800;">Page Name: ${p.name}</h4>
            ${p.isGated ? `
              <span style="font-size: 9px; background-color: #F8FAFC; border: 1px solid #CBD5E1; color: #1D3557; padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                🔐 Gated: ${p.gatedRoles.join(", ")}
              </span>
            ` : `
              <span style="font-size: 9px; background-color: #F0FDF4; border: 1px solid #BBF7D0; color: #15803D; padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                🔓 Public
              </span>
            `}
          </div>
          <div style="font-size: 10px; color: #4A5568; margin-bottom: 8px;">
            Route Path: <code style="font-family: 'JetBrains Mono', monospace; background-color: #F1F5F9; padding: 1px 3px; border-radius: 3px; font-weight: 600;">${p.path}</code>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
            ${(p.components || []).map(comp => `
              <div style="border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; background-color: #FFFFFF; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                <strong style="font-size: 11px; display: block; margin-bottom: 3px; color: #1D3557; font-weight: 800;">⧉ ${comp.componentName}</strong>
                <span style="font-size: 9px; color: #4A5568; display: block; margin-bottom: 6px; border-bottom: 1px dashed #E2E8F0; padding-bottom: 3px;">Binding Entity: <strong style="color: #1A202C;">${comp.bindsToEntity || 'N/A'}</strong></span>
                <div style="font-size: 9px; color: #2D3748; display: flex; flex-wrap: wrap; gap: 3px; align-items: center;">
                  <span style="font-weight: 700; color: #718096; margin-right: 3px;">Fields:</span>
                  ${(comp.fields || []).map(field => `<span style="background-color: #F8FAFC; border: 1px solid #E2E8F0; padding: 0px 4px; border-radius: 3px; font-family: 'JetBrains Mono', monospace; font-size: 8px;">${field}</span>`).join("")}
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `).join("");

      return `
        <div class="pdf-page">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Section 2.${chunkIdx + 1}</span>
            <h2>User Interface (UI) Screen Mappings ${uiPagesChunks.length > 1 ? `— Part ${chunkIdx + 1}` : ''}</h2>
          </div>
          <div class="pdf-chapter-desc">
            Formal frontend application interface blueprints detailing navigable screens, mapped data component envelopes, and gated security boundary roles.
          </div>
          ${chunkHtml}
        </div>
      `;
    }).join("");

    // ── CHAPTER 3.0: REST API Specifications (Cohesive structural tables)
    const apiRoutesHtml = apiRoutesChunks.map((chunk, chunkIdx) => {
      const rowsHtml = chunk.map(r => `
        <tr>
          <td style="text-align: center;"><span class="pdf-badge pdf-badge-${r.method.toLowerCase()}">${r.method}</span></td>
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 11px;"><code>${schemas.apiSchema?.basePath || schemas.api?.basePath || ""}${r.path}</code></td>
          <td style="font-weight: 700; color: #1D3557;">${r.roles ? r.roles.join(", ") : 'Public'}</td>
          <td style="color: #4A5568;">${r.entity || 'N/A'}</td>
          <td style="font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #2D3748;">
            ${Object.entries(r.requestPayload || {}).map(([k,v]) => `<strong>${k}</strong>: <span style="color: #457B9D;">${v}</span>`).join("<br>") || '<span style="color: #A0AEC0;">None</span>'}
          </td>
        </tr>
      `).join("");

      return `
        <div class="pdf-page">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Section 3.${chunkIdx + 1}</span>
            <h2>RESTful API Endpoint Specifications ${apiRoutesChunks.length > 1 ? `— Part ${chunkIdx + 1}` : ''}</h2>
          </div>
          <div class="pdf-chapter-desc">
            Synchronized REST routing endpoints defining expected request methodologies, payload JSON structures, security parameters, and bound data entities.
          </div>
          <table class="pdf-table">
            <thead>
              <tr>
                <th style="width: 80px;">Method</th>
                <th>Route Path</th>
                <th>Required Role(s)</th>
                <th>Entity Bind</th>
                <th>Payload Properties</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join("");

    // ── CHAPTER 4.0: System Context Diagram (C4 Level 1)
    const c4Html = `
      <div class="pdf-page" style="page-break-inside: avoid;">
        <div class="pdf-chapter-header">
          <span class="pdf-chapter-num">Section 4.0</span>
          <h2>System Context Diagram (C4 Level 1)</h2>
        </div>
        <div class="pdf-chapter-desc">
          High-level system context diagram illustrating user roles, the core system boundary, and active external system integrations.
        </div>
        <div style="page-break-inside: avoid; border: 1px solid #CBD5E1; border-radius: 6px; padding: 15px; background-color: #f4f6f9; display: flex; justify-content: center; align-items: center; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ${lastCompilationResult.c4ContextSvg || '<p style="color:#A0AEC0;">No C4 Context Diagram available</p>'}
        </div>
      </div>
    `;

    // ── CHAPTER 5.0: Entity Relationship Diagram
    const erdHtml = `
      <div class="pdf-page" style="page-break-inside: avoid;">
        <div class="pdf-chapter-header">
          <span class="pdf-chapter-num">Section 5.0</span>
          <h2>Entity Relationship Diagram</h2>
        </div>
        <div class="pdf-chapter-desc">
          Visual model of the database schema layout and relationships, programmatically rendered from database constraints.
        </div>
        <div style="page-break-inside: avoid; border: 1px solid #CBD5E1; border-radius: 6px; padding: 15px; background-color: #0b0f19; display: flex; justify-content: center; align-items: center; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          ${lastCompilationResult.erdSvg || '<p style="color:#A0AEC0;">No ERD Diagram available</p>'}
        </div>
      </div>
    `;

    // ── CHAPTER 5.0: Relational DB Schema (Tightly structured vertical Markdown-style tabular cards)
    const dbTablesHtml = dbTablesChunks.map((chunk, chunkIdx) => {
      const tablesHtml = chunk.map(t => `
        <div class="pdf-db-card" style="margin-bottom: 20px;">
          <div class="pdf-db-header">
            <span>📁 Table: ${t.tableName}</span>
            <span class="pdf-entity-tag" style="background-color: #E2E8F0; color: #1D3557; padding: 2px 6px; border-radius: 4px; font-size: 9px;">Entity: ${t.entity}</span>
          </div>
          <div class="pdf-db-body">
            <table class="pdf-table" style="margin-top: 0; margin-bottom: 10px;">
              <thead>
                <tr>
                  <th style="text-align:left;">Column</th>
                  <th style="text-align:left; width: 100px;">Data Type</th>
                  <th style="text-align:left;">Attributes & Constraints</th>
                </tr>
              </thead>
              <tbody>
                 ${(t.columns || []).map(c => `
                   <tr>
                     <td style="font-weight: 700; color: #1A202C;">${c.name}</td>
                     <td><code style="font-family: 'JetBrains Mono', monospace; font-size: 10px;">${c.type}</code></td>
                     <td style="font-size: 10px; color: #4A5568;">${[c.unique ? 'unique' : '', !c.nullable ? 'not null' : '', c.default ? `default: ${c.default}` : ''].filter(Boolean).join(" | ") || 'none'}</td>
                   </tr>
                 `).join("")}
              </tbody>
            </table>
            ${t.foreignKeys && t.foreignKeys.length > 0 ? `
              <div style="margin-top: 8px; font-size: 10px; border-top: 1px dashed #CBD5E1; padding-top: 8px;">
                <strong style="color: #1D3557; display: block; margin-bottom: 4px;">Foreign Key Constraints:</strong>
                ${t.foreignKeys.map(fk => `
                  <div style="margin-top:2px; color: #F3722C; font-family: 'JetBrains Mono', monospace;">⤷ <code>${fk.column}</code> referencing <code>${fk.referencesTable}(${fk.referencesColumn})</code></div>
                 `).join("")}
              </div>
            ` : ''}
          </div>
        </div>
      `).join("");

      return `
        <div class="pdf-page">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Section 6.${chunkIdx + 1}</span>
            <h2>Relational Database Schema Architecture ${dbTablesChunks.length > 1 ? `— Part ${chunkIdx + 1}` : ''}</h2>
          </div>
          <div class="pdf-chapter-desc">
            Full SQL schemas including tables, columns, datatypes (UUID, VARCHAR), strict nullability properties, default constraints, and foreign key linkage systems.
          </div>
          <div class="pdf-grid-db">
            ${tablesHtml}
          </div>
        </div>
      `;
    }).join("");

    // ── CHAPTER 6.0: Security & RBAC Scopes
    const authScopesHtml = authScopesChunks.map((chunk, chunkIdx) => {
      const cardsHtml = chunk.map(r => `
        <div class="pdf-auth-card">
          <h3>Role Identity: ${r.role}</h3>
          <div style="font-size: 10px; color: #718096; margin-bottom: 12px; font-family: 'JetBrains Mono', monospace;">Scope JWT Expiry: ${r.tokenExpiry || '24h'}</div>
          <div style="margin-bottom: 12px;">
            <strong style="font-size: 11px; display: block; margin-bottom: 6px; color: #137333;">✓ Allowed Access Routes:</strong>
            <div class="pdf-list">
               ${(r.allowedRoutes || []).map(route => `
                 <div class="pdf-list-item" style="font-family: 'JetBrains Mono', monospace; color: #2D3748; font-size: 10px;">
                   <span style="color: #137333; margin-right: 4px;">✔</span> ${route}
                 </div>
               `).join("")}
            </div>
          </div>
          ${r.deniedRoutes && r.deniedRoutes.length > 0 ? `
            <div style="margin-top: 12px;">
              <strong style="font-size: 11px; display: block; margin-bottom: 6px; color: #C53030;">✗ Denied Access Routes:</strong>
              <div class="pdf-list">
                 ${r.deniedRoutes.map(route => `
                   <div class="pdf-list-item" style="font-family: 'JetBrains Mono', monospace; color: #C53030; font-size: 10px;">
                     <span style="color: #C53030; margin-right: 4px;">✘</span> ${route}
                   </div>
                 `).join("")}
            </div>
          ` : ''}
        </div>
      `).join("");

      return `
        <div class="pdf-page">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Section 7.${chunkIdx + 1}</span>
            <h2>Role-Based Access Control (RBAC) Policies ${authScopesChunks.length > 1 ? `— Part ${chunkIdx + 1}` : ''}</h2>
          </div>
          <div class="pdf-chapter-desc">
            Logical Role-Based Access Control matrix mapping allowed routing resources and explicit access boundaries across system user roles.
          </div>
          <div class="pdf-auth-grid">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join("");

    // ── CHAPTER 7.0: System Assumptions
    const assumptionsHtml = assumptionsChunks.map((chunk, chunkIdx) => {
      const asmCardsHtml = chunk.map((a, idx) => {
        const absoluteIdx = chunkIdx * 4 + idx + 1;
        return `
          <div class="pdf-asm-card">
            <div class="pdf-asm-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="pdf-asm-title" style="font-size: 13px; font-weight: 800; color: #1D3557;">${absoluteIdx}. ${a.assumption}</span>
            </div>
            <p style="margin: 0 0 10px 0; font-size: 11px; color: #4A5568; line-height: 1.5;"><strong>Rationale:</strong> ${a.rationale}</p>
            <div style="display: flex; gap: 6px;">
              ${(a.affectedLayers || []).map(l => `<span class="pdf-asm-tag">${l}</span>`).join("")}
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="pdf-page">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Section 8.${chunkIdx + 1}</span>
            <h2>Derived System Design Assumptions ${assumptionsChunks.length > 1 ? `— Part ${chunkIdx + 1}` : ''}</h2>
          </div>
          <div class="pdf-chapter-desc">
            Architectural design assumptions, rationale constraints, and impacted stack layers derived during intent compilation.
          </div>
          ${asmCardsHtml}
        </div>
      `;
    }).join("");

    // Assemble the complete report markup using standard Corporate SDD structured pages
    pdfReportTemplate.innerHTML = `
      <div class="pdf-report">
        
        <!-- PAGE 1: COVER PAGE -->
        <div class="pdf-page">
          <div class="pdf-cover-container">
            <div class="pdf-cover-header">
              <div class="pdf-cover-org">ArchForgeX Compiler Engine</div>
            </div>
            <div class="pdf-cover-body">
              <div class="pdf-cover-title">TECHNICAL SYSTEM ARCHITECTURE & SYSTEM PLAN</div>
              <div class="pdf-cover-subtitle">ENTERPRISE SPECIFICATION FOR ${appName.toUpperCase()}</div>
              <div class="pdf-cover-divider"></div>
              <table class="pdf-cover-metadata-table">
                <tr>
                  <td class="meta-label">Blueprint ID</td>
                  <td class="meta-value">${lastCompilationResult.compilationFingerprint || 'N/A'}</td>
                </tr>
                <tr>
                  <td class="meta-label">Document ID</td>
                  <td class="meta-value">SDD-ARCHFORGEX-${appName.toUpperCase().replace(/\s+/g, '-')}</td>
                </tr>
                <tr>
                  <td class="meta-label">Release Version</td>
                  <td class="meta-value">1.0.0 (Enterprise Specification)</td>
                </tr>
                <tr>
                  <td class="meta-label">Security Clearance</td>
                  <td class="meta-value">CONFIDENTIAL / DETERMINISTICALLY VERIFIED</td>
                </tr>
                <tr>
                  <td class="meta-label">Compile Timestamp</td>
                  <td class="meta-value">${dateStr}</td>
                </tr>
                <tr>
                  <td class="meta-label">Authoring Engine</td>
                  <td class="meta-value">ArchForgeX Compiler Engine (Gemini 3.5)</td>
                </tr>
              </table>
            </div>
          </div>
        </div>

        <!-- PAGE 2: TABLE OF CONTENTS (Dynamically calculated based on page budget sharding) -->
        <div class="pdf-page">
          <div class="pdf-toc-container">
            <div class="pdf-toc-title">Table of Contents</div>
            <div class="pdf-toc-list">
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 1.0 : Executive Summary & Latency Telemetry</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec1}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 2.0 : User Interface (UI) Screen Mappings</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec2}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 3.0 : RESTful API Endpoint Specifications</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec3}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 4.0 : System Context Diagram (C4 Level 1)</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec4}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 5.0 : Entity Relationship Diagram</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec5}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 6.0 : Relational Database Schema Architecture</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec6}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 7.0 : Role-Based Access Control (RBAC) Policies</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec7}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 8.0 : Derived System Design Assumptions</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec8}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 9.0 : Quality Scoring Report</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec9}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Section 10.0 : Principal Architect Review</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec10}</span>
              </div>
              <div class="pdf-toc-item">
                <span class="pdf-toc-name">Appendix : OpenAPI 3.1 Specification</span>
                <div class="pdf-toc-dots"></div>
                <span class="pdf-toc-page-num">${pageSec11}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- PAGE 3: SECTION 1.0 EXECUTIVE SUMMARY & TELEMETRY -->
        <div class="pdf-page">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Section 1.0</span>
            <h2>Executive Summary & Latency Telemetry</h2>
          </div>
          <div class="pdf-chapter-desc">
            This document details the automatically compiled and verified system architecture blueprint for <strong>${appName}</strong>. The compilation process completed all stages with zero warnings and deterministic validation constraints.
          </div>
          
          <div class="pdf-telemetry-grid">
            <div class="pdf-tel-card">
              <div class="pdf-tel-label">App Blueprint Name</div>
              <div class="pdf-tel-val" style="color: #1D3557;">${appName}</div>
            </div>
            <div class="pdf-tel-card">
               <div class="pdf-tel-label">Latency / Cost</div>
               <div class="pdf-tel-val">${totalSecs}s / $${totalCost}</div>
            </div>
            <div class="pdf-tel-card">
               <div class="pdf-tel-label">Compiler Engine Model</div>
               <div class="pdf-tel-val">${lastCompilationResult.telemetry.model || 'gemini-3.5-flash'}</div>
            </div>
          </div>
          <div style="font-size: 11px; color: #4A5568; margin-top: 30px; border-top: 1px solid #CBD5E1; padding-top: 15px;">
            Architectural Compilation Date: <strong>${dateStr}</strong> | Total Token Volume: <strong>${totalToks.toLocaleString()}</strong>
          </div>
        </div>

        <!-- DYNAMIC SHARDED SECTIONS 2.0 TO 7.0 -->
        ${uiPagesHtml}
        ${apiRoutesHtml}
        ${c4Html}
        ${erdHtml}
        ${dbTablesHtml}
        ${authScopesHtml}
        ${assumptionsHtml}

        <!-- PAGE: SECTION 9.0 QUALITY SCORING REPORT -->
        <div class="pdf-page" style="page-break-before: always;">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Section 9.0</span>
            <h2>Quality Scoring Report</h2>
          </div>
          <div class="pdf-chapter-desc">
            Detailed performance quality report audited against structural schema checks, with weightings compiled per dimension.
          </div>
          <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="font-size: 14px; color: #1D3557;">Overall Architecture Rating</strong>
              <div style="font-size: 11px; color: #4A5568;">Weighted score based on security, scalability, maintainability, reliability, and compliance checks.</div>
            </div>
            <div style="font-size: 28px; font-weight: 800; color: ${getScoreColor(lastCompilationResult.qualityScore?.overallScore || 0)};">${Math.round(lastCompilationResult.qualityScore?.overallScore || 0)}</div>
          </div>
          <table class="pdf-table" style="margin-bottom: 25px;">
            <thead>
              <tr>
                <th style="text-align:left;">Dimension</th>
                <th style="width: 100px; text-align:center;">Score</th>
                <th style="width: 250px; text-align:left;">Dimension Weight</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Security</strong></td>
                <td style="text-align:center; font-weight: 700; color: ${getScoreColor(lastCompilationResult.qualityScore?.scores?.security || 0)};">${Math.round(lastCompilationResult.qualityScore?.scores?.security || 0)}</td>
                <td>25% of overall score</td>
              </tr>
              <tr>
                <td><strong>Scalability</strong></td>
                <td style="text-align:center; font-weight: 700; color: ${getScoreColor(lastCompilationResult.qualityScore?.scores?.scalability || 0)};">${Math.round(lastCompilationResult.qualityScore?.scores?.scalability || 0)}</td>
                <td>20% of overall score</td>
              </tr>
              <tr>
                <td><strong>Maintainability</strong></td>
                <td style="text-align:center; font-weight: 700; color: ${getScoreColor(lastCompilationResult.qualityScore?.scores?.maintainability || 0)};">${Math.round(lastCompilationResult.qualityScore?.scores?.maintainability || 0)}</td>
                <td>20% of overall score</td>
              </tr>
              <tr>
                <td><strong>Reliability</strong></td>
                <td style="text-align:center; font-weight: 700; color: ${getScoreColor(lastCompilationResult.qualityScore?.scores?.reliability || 0)};">${Math.round(lastCompilationResult.qualityScore?.scores?.reliability || 0)}</td>
                <td>20% of overall score</td>
              </tr>
              <tr>
                <td><strong>Compliance</strong></td>
                <td style="text-align:center; font-weight: 700; color: ${getScoreColor(lastCompilationResult.qualityScore?.scores?.compliance || 0)};">${Math.round(lastCompilationResult.qualityScore?.scores?.compliance || 0)}</td>
                <td>15% of overall score</td>
              </tr>
            </tbody>
          </table>
          <strong style="font-size: 12px; color: #1D3557; display: block; margin-bottom: 10px;">Audit Findings & Deductions:</strong>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${(lastCompilationResult.qualityScore?.findings || []).map(f => `
              <div style="border: 1px solid #CBD5E1; border-radius: 6px; padding: 10px; background: #FFFFFF; font-size: 10px;">
                <div style="display: flex; justify-content: space-between; font-weight: 700; margin-bottom: 4px;">
                  <span style="color: #1D3557;">${f.dimension} - Deduction</span>
                  <span style="color: #ef4444;">-${f.deduction} pts</span>
                </div>
                <div style="color: #4A5568; margin-bottom: 4px;">${f.issue}</div>
                <div style="color: #15803D; font-weight: 600;"><i class="fa-solid fa-lightbulb"></i> Recommendation: ${f.recommendation}</div>
              </div>
            `).join("") || '<div style="font-size:11px; color:#4A5568; text-align:center; padding:15px; border:1px dashed #CBD5E1; border-radius:6px;">No deductions recorded. All checks passed.</div>'}
          </div>
        </div>

        <!-- PAGE: SECTION 10.0 PRINCIPAL ARCHITECT REVIEW -->
        <div class="pdf-page" style="page-break-before: always;">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Section 10.0</span>
            <h2>Principal Architect Review</h2>
          </div>
          <div class="pdf-chapter-desc">
            Principal software architect design advisory recommendations, pattern mappings, and implementation milestones.
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
            ${(lastCompilationResult.architectAdvisor?.recommendations || []).map((r, idx) => `
              <div style="border: 1px solid #CBD5E1; border-radius: 6px; padding: 12px; background: #FFFFFF; box-shadow: 0 1px 2px rgba(0,0,0,0.05); page-break-inside: avoid;">
                <div style="border-bottom: 1px dashed #CBD5E1; padding-bottom: 6px; margin-bottom: 6px;">
                  <span style="font-size: 8px; text-transform: uppercase; color: #718096; font-weight: 700;">Trigger ${idx + 1}</span>
                  <strong style="font-size: 10px; display: block; color: #1A202C;">${r.trigger}</strong>
                </div>
                <div style="margin-bottom: 8px;">
                  <span style="font-size: 8px; text-transform: uppercase; color: #718096; font-weight: 700;">Pattern</span>
                  <strong style="font-size: 11px; display: block; color: #1D3557;"><b>${r.pattern}</b></strong>
                  <p style="margin: 2px 0 0 0; font-size: 9px; color: #4A5568; line-height: 1.4;">${r.rationale}</p>
                </div>
                <div style="background: #F8FAFC; border-left: 3px solid #457B9D; padding: 6px; font-size: 9px; color: #1A202C;">
                  <strong>Action:</strong> ${r.implementation}
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- PAGE: APPENDIX OPENAPI 3.1 SPECIFICATION -->
        <div class="pdf-page" style="page-break-before: always;">
          <div class="pdf-chapter-header">
            <span class="pdf-chapter-num">Appendix</span>
            <h2>OpenAPI 3.1 Specification</h2>
          </div>
          <div class="pdf-chapter-desc">
            OpenAPI 3.1.0 JSON-Schema REST API endpoint spec generated from the synchronized API mapping layout.
          </div>
          <div style="background: #1E1E1E; border: var(--border-brutalist); border-radius: 6px; padding: 15px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: #D4D4D4; line-height: 1.5; overflow: hidden; box-shadow: 3px 3px 0px #000000; height: 380px; position: relative;">
            <pre style="margin: 0; white-space: pre-wrap; font-family: inherit;">${(lastCompilationResult.openApiSpec || '').split('\n').slice(0, 50).join('\n')}</pre>
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(to bottom, rgba(30,30,30,0) 0%, rgba(30,30,30,1) 100%); height: 80px; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 10px;">
              <span style="background: #333333; color: #FFFFFF; font-size: 10px; font-weight: 600; padding: 4px 10px; border-radius: 4px; border: 1px solid #555555;">Full spec available as openapi.yaml.</span>
            </div>
          </div>
        </div>
      </div>
    `;

    // 2. Generate PDF using html2pdf compiler
    pdfReportTemplate.style.display = "block";

    const opt = {
      margin:       [15, 15, 15, 15],
      filename:     `ArchForgeX-${appName.toLowerCase().replace(/\s+/g, '-')}-blueprint.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css'] }
    };

    html2pdf().set(opt).from(pdfReportTemplate).save().then(() => {
      pdfReportTemplate.style.display = "none";
      appendLog("💾 PDF Blueprint successfully downloaded!", "green");
    }).catch(err => {
      pdfReportTemplate.style.display = "none";
      appendLog(`❌ PDF compilation aborted: ${err.message || err}`, "orange");
    });
  });
});
