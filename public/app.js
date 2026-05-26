/**
 * AI Signal Compiler Pipeline — Client Logic
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

  const exportPdfBtn     = document.getElementById("export-pdf-btn");
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
      if (targetPane) targetPane.classList.add("active");
    });
  });

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

    // 1. Dynamic UI pages
    const uiPagesHtml = (schemas.uiSchema?.pages || schemas.ui?.pages || []).map(p => `
      <div style="margin-bottom: 20px; border-bottom: 1px dashed #ccc; padding-bottom: 15px; page-break-inside: avoid;">
        <h4 style="margin: 0 0 5px 0; color: #000; font-size: 13px;">Page Name: ${p.name}</h4>
        <span style="font-size: 11px; color: #555;">Route Path: <strong style="font-family: monospace;">${p.path}</strong> | Gated: ${p.isGated ? `Yes (Allowed Roles: ${p.gatedRoles.join(", ")})` : 'No (Public)'}</span>
        <div style="margin-top: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
          ${(p.components || []).map(comp => `
            <div style="border: 1px solid #000; padding: 8px; background-color: #F8F9FA;">
              <strong style="font-size: 11px; display: block; margin-bottom: 4px; color: #FF6F20;">⧉ Component: ${comp.componentName}</strong>
              <span style="font-size: 10px; color: #666; display: block; margin-bottom: 4px;">Binding Entity: ${comp.bindsToEntity || 'N/A'}</span>
              <div style="font-size: 10px; color: #000;">Fields: ${(comp.fields || []).join(", ")}</div>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    // 2. Dynamic API Routes Table
    const apiRoutesHtml = (schemas.apiSchema?.routes || schemas.api?.routes || []).map(r => `
      <tr>
        <td style="text-align: center;"><span class="pdf-badge pdf-badge-method">${r.method}</span></td>
        <td style="font-family: monospace;"><code>${schemas.apiSchema?.basePath || schemas.api?.basePath || ""}${r.path}</code></td>
        <td style="font-weight: 700;">${r.roles ? r.roles.join(", ") : 'Public'}</td>
        <td style="color: #555;">${r.entity || 'N/A'}</td>
        <td style="font-family: monospace; font-size: 10px;">${Object.entries(r.requestPayload || {}).map(([k,v]) => `${k}:${v}`).join(", ") || 'None'}</td>
      </tr>
    `).join("");

    // 3. Dynamic DB Schema
    const dbTablesHtml = (schemas.dbSchema?.tables || schemas.db?.tables || []).map(t => `
      <div class="pdf-db-card">
        <div class="pdf-db-header">
          <span>📁 Table: ${t.tableName}</span>
          <span class="pdf-entity-tag">Entity: ${t.entity}</span>
        </div>
        <div class="pdf-db-body">
          <table class="pdf-table" style="margin-top: 0;">
            <thead>
              <tr>
                <th style="text-align:left;">Column</th>
                <th style="text-align:left; width: 80px;">Type</th>
                <th style="text-align:left;">Attributes</th>
              </tr>
            </thead>
            <tbody>
               ${(t.columns || []).map(c => `
                 <tr>
                   <td><strong>${c.name}</strong></td>
                   <td><code>${c.type}</code></td>
                   <td>${[c.unique ? 'unique' : '', !c.nullable ? 'not null' : '', c.default ? `default: ${c.default}` : ''].filter(Boolean).join(" | ") || 'none'}</td>
                 </tr>
               `).join("")}
            </tbody>
          </table>
          ${t.foreignKeys && t.foreignKeys.length > 0 ? `
            <div style="margin-top: 10px; font-size: 10px; border-top: 1px dashed #ccc; padding-top: 6px;">
              <strong>Foreign Key Constraints:</strong>
              ${t.foreignKeys.map(fk => `
                <div style="margin-top:2px; color: #F3722C;">⤷ <code>${fk.column}</code> referencing <code>${fk.referencesTable}(${fk.referencesColumn})</code></div>
               `).join("")}
            </div>
          ` : ''}
        </div>
      </div>
    `).join("");

    // 4. Dynamic Auth Scopes
    const authScopesHtml = (schemas.authSchema?.rolePermissions || schemas.auth?.rolePermissions || []).map(r => `
      <div class="pdf-auth-card">
        <h3>Role Identity: ${r.role}</h3>
        <div style="font-size: 10px; color: #666; margin-bottom: 8px; font-family: monospace;">Scope JWT Expiry: ${r.tokenExpiry || '24h'}</div>
        <div style="margin-bottom: 8px;">
          <strong style="font-size: 11px; display: block; margin-bottom: 4px; color: #2A9D8F;">✓ Allowed Access Routes:</strong>
          <div class="pdf-list">
             ${(r.allowedRoutes || []).map(route => `<div class="pdf-list-item" style="font-family: monospace;">⤷ ${route}</div>`).join("")}
          </div>
        </div>
        ${r.deniedRoutes && r.deniedRoutes.length > 0 ? `
          <div style="margin-top: 8px;">
            <strong style="font-size: 11px; display: block; margin-bottom: 4px; color: #E63946;">✗ Denied Access Routes:</strong>
            <div class="pdf-list">
               ${r.deniedRoutes.map(route => `<div class="pdf-list-item" style="font-family: monospace; color: #E63946;">⤷ ${route}</div>`).join("")}
            </div>
          </div>
        ` : ''}
      </div>
    `).join("");

    // 5. Dynamic Assumptions
    const assumptionsHtml = (lastCompilationResult.systemAssumptions || schemas.systemAssumptions || []).map((a, idx) => `
      <div class="pdf-asm-card">
        <h4 style="margin: 0 0 5px 0; color: #000;">${idx+1}. ${a.assumption}</h4>
        <p style="margin: 0; font-size: 11px; color: #555;">Rationale: ${a.rationale}</p>
        <div style="margin-top: 8px;">
          ${(a.affectedLayers || []).map(l => `<span class="pdf-badge" style="margin-right: 4px; background-color: #F9C74F;">${l}</span>`).join("")}
        </div>
      </div>
    `).join("");

    // Assemble the full report markup
    pdfReportTemplate.innerHTML = `
      <div class="pdf-report">
        <!-- PDF HEADER -->
        <div class="pdf-header">
          <div class="pdf-logo">
            <h1>AI SIGNAL COMPILER PIPELINE</h1>
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #555; tracking-spacing: 1px;">Synchronized Architecture Specifications Blueprint</span>
          </div>
          <span class="pdf-meta-badge">OFFICIAL ARCHITECT SPECIFICATION</span>
        </div>

        <!-- TELEMETRY -->
        <div class="pdf-telemetry-grid">
          <div class="pdf-tel-card">
            <div class="pdf-tel-label">App Blueprint Name</div>
            <div class="pdf-tel-val" style="color: #F3722C;">${appName}</div>
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

        <div style="font-size: 11px; color: #555; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 6px;">
          Architectural Compilation Date: <strong>${dateStr}</strong> | Total Token Volume: <strong>${totalToks.toLocaleString()}</strong>
        </div>

        <!-- CHAPTER 1 -->
        <div class="pdf-section">
          <h2>Chapter 1: User Interface Blueprint</h2>
          <p style="margin-bottom: 20px; font-size: 12px; color: #555;">Formal frontend application interface blueprints detailing navigable screens, mapped data component envelopes, and gated security boundary roles.</p>
          ${uiPagesHtml}
        </div>

        <!-- CHAPTER 2 -->
        <div class="pdf-section">
          <h2>Chapter 2: REST API Specifications</h2>
          <p style="margin-bottom: 20px; font-size: 12px; color: #555;">Synchronized REST routing endpoints defining expected request methodologies, payload JSON structures, security parameters, and bound data entities.</p>
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
              ${apiRoutesHtml}
            </tbody>
          </table>
        </div>

        <!-- CHAPTER 3 -->
        <div class="pdf-section">
          <h2>Chapter 3: Relational Database Schema</h2>
          <p style="margin-bottom: 20px; font-size: 12px; color: #555;">Full SQL schemas including tables, columns, datatypes (UUID, VARCHAR), strict nullability properties, default constraints, and foreign key linkage systems.</p>
          <div class="pdf-grid-db">
            ${dbTablesHtml}
          </div>
        </div>

        <!-- CHAPTER 4 -->
        <div class="pdf-section">
          <h2>Chapter 4: Security & RBAC Scopes</h2>
          <p style="margin-bottom: 20px; font-size: 12px; color: #555;">Logical Role-Based Access Control matrix mapping allowed routing resources and explicit access boundaries across system user roles.</p>
          <div class="pdf-auth-grid">
            ${authScopesHtml}
          </div>
        </div>

        <!-- CHAPTER 5 -->
        <div class="pdf-section">
          <h2>Chapter 5: System Design Assumptions</h2>
          <p style="margin-bottom: 20px; font-size: 12px; color: #555;">Architectural design assumptions, rationale constraints, and impacted stack layers derived during intent compilation.</p>
          ${assumptionsHtml}
        </div>
      </div>
    `;

    // 2. Generate PDF using html2pdf compiler
    pdfReportTemplate.style.display = "block";

    const opt = {
      margin:       [10, 10, 10, 10],
      filename:     `AI-Signal-${appName.toLowerCase().replace(/\s+/g, '-')}-blueprint.pdf`,
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
