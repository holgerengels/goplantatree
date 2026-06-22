<template>
  <AdminLayout>
    <div class="newsletter-page">
      <div class="newsletter-header">
        <div class="newsletter-title">
          <component :is="icons.Send" class="title-icon" />
          <h1>Newsletter versenden</h1>
        </div>
      </div>

      <!-- Recipients -->
      <div class="card newsletter-section">
        <h2 class="section-title">
          <component :is="icons.Users" :size="20" />
          Empfänger:innen
        </h2>

        <div class="recipient-grid">
          <wa-select label="Mail-Konto" :value="form.account" @change="form.account = $event.target.value">
            <wa-option v-for="acc in accounts" :key="acc" :value="acc">{{ acc }}</wa-option>
          </wa-select>

          <wa-select label="Projekt" :value="form.project" @change="form.project = $event.target.value">
            <wa-option value="">Alle Projekte</wa-option>
            <wa-option v-for="p in projects" :key="p.slug" :value="p.slug">{{ p.name }}</wa-option>
          </wa-select>

          <wa-select label="Thema" :value="form.topic" @change="form.topic = $event.target.value">
            <wa-option value="">Alle Themen</wa-option>
            <wa-option v-for="t in topics" :key="t" :value="t">{{ t }}</wa-option>
          </wa-select>

          <wa-select label="Thema ausschließen" :value="form.excludeTopic" @change="form.excludeTopic = $event.target.value" clearable>
            <wa-option value="">— Keins —</wa-option>
            <wa-option v-for="t in topics" :key="t" :value="t">{{ t }}</wa-option>
          </wa-select>
        </div>

        <div class="recipient-info">
          <wa-badge v-if="recipientCount !== null" :variant="recipientCount > 0 ? 'success' : 'neutral'">
            {{ recipientCount }} bestätigte Empfänger:innen
          </wa-badge>
          <span v-if="loadingRecipients" class="loading-text">Lade Empfänger:innen …</span>
        </div>
      </div>

      <!-- Content -->
      <div class="card newsletter-section">
        <h2 class="section-title">
          <component :is="icons.FileText" :size="20" />
          Inhalt
        </h2>

        <div class="template-selector">
          <wa-select label="Template laden" :value="selectedTemplate" @change="loadTemplate($event.target.value)" help-text="Wähle ein Template als Startpunkt — du kannst es danach noch anpassen.">
            <wa-option value="">— Kein Template —</wa-option>
            <wa-option v-for="t in templates" :key="t._id" :value="t._id">{{ t.name }} ({{ t.project || 'global' }})</wa-option>
          </wa-select>
        </div>

        <wa-input
          label="Betreff"
          :value="form.subject"
          @input="form.subject = $event.target.value"
          placeholder="z.B. 🌳 Neuigkeiten von Go Plant A Tree"
          help-text="Platzhalter verfügbar: {{name}}, {{email}}, {{data.xxx}}"
          required
        ></wa-input>

        <div class="editor-wrapper">
          <label class="form-label">Mail-Body (HTML)</label>
          <HtmlEditor
            v-model="form.html"
            language="html"
            height="400px"
          />
        </div>

        <wa-callout v-if="!hasUnsubscribeLink" variant="warning" appearance="filled-outlined">
          <wa-icon slot="icon" name="exclamation-triangle"></wa-icon>
          <strong>Kein Abmelde-Link!</strong> Bitte füge <code>{<!-- -->{unsubscribe_url}}</code> in den Body ein, damit Empfänger:innen sich abmelden können.
        </wa-callout>

        <wa-callout variant="neutral" appearance="filled-outlined" class="placeholder-help">
          <wa-icon slot="icon" name="info-circle"></wa-icon>
          <div>
            <strong>Verfügbare Platzhalter:</strong><br>
            <code>{<!-- -->{name}}</code> — Name,
            <code>{<!-- -->{email}}</code> — E-Mail,
            <code>{<!-- -->{project}}</code> — Projekt,
            <code>{<!-- -->{topics}}</code> — Themen,
            <code>{<!-- -->{unsubscribe_url}}</code> — Abmelde-Link,
            <code>{<!-- -->{data.xxx}}</code> — Zusatzdaten
          </div>
        </wa-callout>
      </div>

      <!-- Preview -->
      <div class="card newsletter-section">
        <button class="section-toggle" @click="showPreview = !showPreview">
          <h2 class="section-title">
            <component :is="icons.Eye" :size="20" />
            Vorschau
          </h2>
          <component :is="showPreview ? icons.ChevronUp : icons.ChevronDown" :size="20" />
        </button>

        <div v-if="showPreview" class="preview-area">
          <div class="preview-subject">
            <strong>Betreff:</strong> {{ renderedPreviewSubject }}
          </div>
          <iframe
            :srcdoc="renderedPreviewHtml"
            class="preview-iframe"
            sandbox=""
          ></iframe>
        </div>
      </div>

      <!-- Send -->
      <div class="newsletter-actions">
        <wa-button
          variant="primary"
          size="large"
          @click="sendNewsletter"
          :disabled="!canSend || sending ? true : undefined"
          :loading="sending ? true : undefined"
        >
          <wa-icon name="send" slot="prefix"></wa-icon>
          {{ sending ? 'Wird gestartet…' : 'Newsletter senden' }}
        </wa-button>

        <span v-if="!form.account" class="send-hint">⚠ Bitte Mail-Konto auswählen</span>
        <span v-else-if="!form.subject" class="send-hint">⚠ Betreff eingeben</span>
        <span v-else-if="!form.html" class="send-hint">⚠ Body eingeben</span>
        <span v-else-if="!hasUnsubscribeLink" class="send-hint">⚠ Abmelde-Link fehlt</span>
        <span v-else-if="recipientCount === 0" class="send-hint">⚠ Keine Empfänger:innen</span>
      </div>

      <!-- Campaign Progress -->
      <div v-if="campaign" class="card newsletter-section campaign-progress">
        <h2 class="section-title">
          <component :is="campaignIcon" :size="20" />
          Campaign: {{ campaign.campaignId }}
        </h2>

        <!-- Progress bar -->
        <div class="progress-wrapper">
          <div class="progress-bar">
            <div class="progress-fill progress-sent" :style="{ width: sentPercent + '%' }"></div>
            <div class="progress-fill progress-failed" :style="{ width: failedPercent + '%' }"></div>
          </div>
          <div class="progress-label">
            {{ campaign.sent + campaign.failed }}/{{ campaign.total }}
            <span v-if="campaign.status === 'rate-limited'" class="rate-limit-hint">⏳ Rate-Limit — pausiert</span>
          </div>
        </div>

        <!-- Status badges -->
        <div class="result-badges">
          <wa-badge variant="success">{{ campaign.sent }} gesendet</wa-badge>
          <wa-badge v-if="campaign.failed > 0" variant="danger">{{ campaign.failed }} fehlgeschlagen</wa-badge>
          <wa-badge v-if="campaign.queued > 0" variant="warning">{{ campaign.queued }} ausstehend</wa-badge>
          <wa-badge v-if="campaign.bounced > 0" variant="neutral">{{ campaign.bounced }} bounced</wa-badge>
          <wa-badge variant="neutral">{{ campaign.total }} gesamt</wa-badge>
        </div>

        <!-- Status line -->
        <div class="campaign-status">
          <span :class="'status-' + campaign.status">{{ statusLabel }}</span>
          <span v-if="campaign.lastActivity" class="status-time">
            Letzte Aktivität: {{ formatTime(campaign.lastActivity) }}
          </span>
        </div>

        <!-- Errors -->
        <div v-if="campaign.errors?.length" class="result-errors">
          <h3>Letzte Fehler:</h3>
          <ul>
            <li v-for="(err, i) in campaign.errors.slice(-10)" :key="i">
              {{ err.email }}: {{ err.error }}
            </li>
          </ul>
        </div>

        <!-- Action buttons -->
        <div class="campaign-actions">
          <wa-button
            v-if="['stopped', 'aborted', 'error'].includes(campaign.status) && campaign.queued > 0"
            variant="primary"
            @click="resumeCampaign"
            :loading="resuming ? true : undefined"
          >
            <wa-icon name="play" slot="prefix"></wa-icon>
            Fortsetzen ({{ campaign.queued }} ausstehend)
          </wa-button>

          <wa-button
            v-if="campaign.status === 'sending' || campaign.status === 'rate-limited'"
            variant="danger"
            appearance="outlined"
            @click="abortCampaign"
          >
            <wa-icon name="x-circle" slot="prefix"></wa-icon>
            Abbrechen
          </wa-button>

          <wa-button
            v-if="['stopped', 'aborted', 'error', 'completed'].includes(campaign.status)"
            variant="danger"
            appearance="outlined"
            @click="deleteCampaign"
          >
            <wa-icon name="trash-2" slot="prefix"></wa-icon>
            Löschen
          </wa-button>
        </div>
      </div>

      <!-- Bounce Check (account-wide, not campaign-specific) -->
      <div class="card newsletter-section">
        <h2 class="section-title">
          <component :is="icons.ShieldAlert" :size="20" />
          Bounce-Erkennung
        </h2>
        <p class="section-hint">Prüft alle E-Mail-Konten per IMAP auf Bounce-Nachrichten und markiert betroffene Abonnent:innen.</p>
        <div class="campaign-actions">
          <wa-button
            variant="neutral"
            @click="checkBounces"
            :loading="checkingBounces ? true : undefined"
          >
            <wa-icon name="refresh-cw" slot="prefix"></wa-icon>
            Alle Accounts prüfen
          </wa-button>
        </div>

        <div v-if="bounceResult" class="bounce-result">
          <wa-badge variant="neutral">{{ bounceResult.checked }} geprüft</wa-badge>
          <wa-badge :variant="bounceResult.bounced > 0 ? 'danger' : 'success'">{{ bounceResult.bounced }} Bounces</wa-badge>
          <div v-if="bounceResult.errors?.length" class="bounce-errors">
            <wa-badge v-for="(e, i) in bounceResult.errors" :key="i" variant="warning">{{ e.account }}: {{ e.error }}</wa-badge>
          </div>
          <ul v-if="bounceResult.details?.length" class="bounce-details">
            <li v-for="(d, i) in bounceResult.details" :key="i">
              {{ d.address }} — <code>{{ d.type }}</code> {{ d.diagnosticCode }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue';
import * as icons from 'lucide-vue-next';
import AdminLayout from '../../components/admin/AdminLayout.vue';
import HtmlEditor from '../../components/forms/HtmlEditor.vue';
import { api } from '../../services/api.js';
import { toast, confirm } from '../../composables/useToast.js';

const accounts = ref([]);
const projects = ref([]);
const recipientCount = ref(null);
const loadingRecipients = ref(false);
const sending = ref(false);
const showPreview = ref(false);
const topics = ref([]);
const templates = ref([]);
const selectedTemplate = ref('');

// Campaign tracking
const campaign = ref(null);
const resuming = ref(false);
let pollInterval = null;

const form = reactive({
    account: '',
    project: '',
    topic: '',
    excludeTopic: '',
    subject: '',
    html: '',
    text: ''
});

// Check for unsubscribe placeholder
const hasUnsubscribeLink = computed(() => {
    return /\{\{\s*unsubscribe_url\s*\}\}/.test(form.html);
});

const canSend = computed(() => {
    return form.account && form.subject && form.html && hasUnsubscribeLink.value && recipientCount.value > 0;
});

// Campaign computed
const sentPercent = computed(() => {
    if (!campaign.value || !campaign.value.total) return 0;
    return Math.round((campaign.value.sent / campaign.value.total) * 100);
});

const failedPercent = computed(() => {
    if (!campaign.value || !campaign.value.total) return 0;
    return Math.round((campaign.value.failed / campaign.value.total) * 100);
});

const campaignIcon = computed(() => {
    const s = campaign.value?.status;
    if (s === 'completed') return icons.CheckCircle;
    if (s === 'sending' || s === 'rate-limited') return icons.Loader;
    if (s === 'stopped' || s === 'aborted') return icons.PauseCircle;
    if (s === 'error') return icons.AlertCircle;
    return icons.Clock;
});

const statusLabel = computed(() => {
    const labels = {
        'starting': '⏳ Wird gestartet…',
        'sending': '📤 Wird versendet…',
        'rate-limited': '⏳ Rate-Limit erreicht — pausiert bis nächste Stunde',
        'completed': '✅ Abgeschlossen',
        'aborted': '⏸ Abgebrochen',
        'stopped': '⏸ Gestoppt (Server-Neustart?)',
        'error': '❌ Fehler',
        'resuming': '▶ Wird fortgesetzt…'
    };
    return labels[campaign.value?.status] || campaign.value?.status;
});

const formatTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

// Preview rendering with example data
const exampleVars = {
    name: 'Max Mustermann',
    email: 'max@example.com',
    project: 'klimabaumaktion-ulm',
    topic: 'general',
    topics: ['general'],
    unsubscribe_url: '#abmelden-vorschau',
    data: { orderNumber: 'GPT-2026-0042', quantity: 3 }
};

const renderPreview = (template) => {
    if (!template) return '';
    return template.replace(/\{\{(\s*[\w.]+\s*)\}\}/g, (match, key) => {
        const trimmed = key.trim();
        const value = trimmed.split('.').reduce((o, k) => (o != null ? o[k] : undefined), exampleVars);
        if (value === undefined || value === null) return `{{${trimmed}}}`;
        return String(value);
    });
};

const renderedPreviewSubject = computed(() => renderPreview(form.subject));
const renderedPreviewHtml = computed(() => renderPreview(form.html));

// Load recipient count when filters change
const loadRecipientCount = async () => {
    loadingRecipients.value = true;
    try {
        const params = new URLSearchParams();
        params.append('status', 'confirmed');
        if (form.project) params.append('project', form.project);
        if (form.topic) params.append('topic', form.topic);
        if (form.excludeTopic) params.append('excludeTopic', form.excludeTopic);

        const data = await api.get(`/subscribers?${params.toString()}`);
        const items = Array.isArray(data) ? data : (data.items || []);
        recipientCount.value = items.length;
    } catch {
        recipientCount.value = null;
    } finally {
        loadingRecipients.value = false;
    }
};

watch([() => form.project, () => form.topic, () => form.excludeTopic], () => {
    loadRecipientCount();
});

// ─── Campaign polling ────────────────────────────────────────────────────

const pollCampaign = async () => {
    if (!campaign.value?.campaignId) return;
    try {
        const data = await api.get(`/mail/campaigns/${campaign.value.campaignId}`);
        campaign.value = data;

        // Stop polling if campaign is done
        if (['completed', 'aborted', 'error', 'stopped'].includes(data.status)) {
            stopPolling();
        }
    } catch {
        // silently ignore poll errors
    }
};

const startPolling = () => {
    stopPolling();
    pollInterval = setInterval(pollCampaign, 5000);
};

const stopPolling = () => {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
};

onUnmounted(() => stopPolling());

// ─── Send newsletter ─────────────────────────────────────────────────────

const sendNewsletter = async () => {
    if (!canSend.value) return;

    const ok = await confirm(`Newsletter an ${recipientCount.value} Empfänger:innen senden?\n\nDer Versand läuft im Hintergrund. Du kannst den Fortschritt hier verfolgen.`);
    if (!ok) return;

    sending.value = true;
    campaign.value = null;

    try {
        const payload = {
            account: form.account,
            subject: form.subject,
            html: form.html
        };
        if (form.project) payload.project = form.project;
        if (form.topic) payload.topic = form.topic;
        if (form.excludeTopic) payload.excludeTopic = form.excludeTopic;
        if (form.text) payload.text = form.text;

        const result = await api.post('/mail/send-newsletter', payload);

        if (result.campaignId) {
            toast.success(`📨 Campaign ${result.campaignId} gestartet — ${result.queued} Mails in der Queue`);
            campaign.value = {
                campaignId: result.campaignId,
                total: result.total || result.queued,
                sent: 0,
                failed: 0,
                queued: result.queued,
                bounced: 0,
                status: 'sending',
                errors: []
            };
            startPolling();
        } else {
            // Fallback for zero recipients etc.
            toast.info(result.message || 'Keine Empfänger gefunden.');
        }
    } catch (err) {
        toast.error('Fehler beim Starten: ' + err.message);
    } finally {
        sending.value = false;
    }
};

// ─── Resume / Abort ──────────────────────────────────────────────────────

const resumeCampaign = async () => {
    if (!campaign.value?.campaignId) return;
    resuming.value = true;
    try {
        await api.post(`/mail/campaigns/${campaign.value.campaignId}/resume`);
        toast.success('Campaign wird fortgesetzt…');
        campaign.value.status = 'resuming';
        startPolling();
    } catch (err) {
        toast.error('Resume fehlgeschlagen: ' + err.message);
    } finally {
        resuming.value = false;
    }
};

const abortCampaign = async () => {
    if (!campaign.value?.campaignId) return;
    const ok = await confirm('Campaign wirklich abbrechen?\n\nBereits gesendete Mails bleiben erhalten. Du kannst den Versand später fortsetzen.');
    if (!ok) return;
    try {
        await api.post(`/mail/campaigns/${campaign.value.campaignId}/abort`);
        toast.info('Campaign wird abgebrochen…');
        // Poll once more to get final status
        setTimeout(pollCampaign, 2000);
    } catch (err) {
        toast.error('Abbruch fehlgeschlagen: ' + err.message);
    }
};

const deleteCampaign = async () => {
    if (!campaign.value?.campaignId) return;
    const ok = await confirm('Campaign wirklich löschen?\n\nAlle zugehörigen Mail-Logs werden ebenfalls gelöscht. Dies kann nicht rückgängig gemacht werden.');
    if (!ok) return;
    try {
        await api.delete(`/mail/campaigns/${campaign.value.campaignId}`);
        toast.success('Campaign gelöscht.');
        campaign.value = null;
        stopPolling();
    } catch (err) {
        toast.error('Löschen fehlgeschlagen: ' + err.message);
    }
};

// ─── Bounce check ────────────────────────────────────────────────────────

const checkingBounces = ref(false);
const bounceResult = ref(null);

const checkBounces = async () => {
    checkingBounces.value = true;
    bounceResult.value = null;
    try {
        const result = await api.post('/mail/check-bounces');
        bounceResult.value = result;
        if (result.bounced > 0) {
            toast.success(`${result.bounced} Bounce(s) erkannt und markiert.`);
            if (campaign.value) pollCampaign();
        } else {
            toast.info(`${result.checked} Mails geprüft, keine Bounces.`);
        }
        if (result.errors?.length) {
            toast.warning(`${result.errors.length} Account(s) mit Fehlern.`);
        }
    } catch (err) {
        toast.error('Bounce-Check fehlgeschlagen: ' + err.message);
    } finally {
        checkingBounces.value = false;
    }
};

// ─── Init ────────────────────────────────────────────────────────────────

onMounted(async () => {
    try {
        accounts.value = await api.get('/mail/accounts');
        if (accounts.value.length > 0) {
            form.account = accounts.value[0];
        }
    } catch (e) {
        console.warn('Mail-Konten konnten nicht geladen werden:', e.message);
    }

    try {
        const data = await api.get('/projects?all=true');
        projects.value = Array.isArray(data) ? data : (data.items || []);
    } catch { /* skip */ }

    try {
        topics.value = await api.get('/subscribers/distinct/topics');
    } catch { /* skip */ }

    try {
        const data = await api.get('/mail-templates?type=newsletter');
        templates.value = Array.isArray(data) ? data : (data.items || []);
    } catch { /* skip */ }

    // Check if there's a running/stopped campaign
    try {
        const campaigns = await api.get('/mail/campaigns');
        if (campaigns.length > 0) {
            const latest = campaigns[0];
            if (['sending', 'rate-limited', 'stopped'].includes(latest.status) || latest.queued > 0) {
                campaign.value = latest;
                if (['sending', 'rate-limited'].includes(latest.status)) {
                    startPolling();
                }
            }
        }
    } catch { /* skip */ }

    loadRecipientCount();
});

const loadTemplate = async (templateId) => {
    selectedTemplate.value = templateId;
    if (!templateId) return;
    const tpl = templates.value.find(t => t._id === templateId);
    if (tpl) {
        form.subject = tpl.subject || '';
        form.html = tpl.html || '';
    }
};

// Reload templates when project filter changes
watch(() => form.project, async () => {
    try {
        const params = new URLSearchParams({ type: 'newsletter' });
        if (form.project) params.append('project', form.project);
        const data = await api.get(`/mail-templates?${params.toString()}`);
        templates.value = Array.isArray(data) ? data : (data.items || []);
        selectedTemplate.value = '';
    } catch { /* skip */ }
});
</script>

<style scoped>
.newsletter-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-width: 900px;
}

.template-selector {
    margin-bottom: var(--space-sm);
}

.newsletter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.newsletter-title {
    display: flex;
    align-items: center;
    gap: var(--space-md);
}

.title-icon {
    width: 32px;
    height: 32px;
    color: var(--color-primary);
}

.newsletter-title h1 {
    font-size: var(--text-2xl);
    margin: 0;
}

.newsletter-section {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
}

.section-title {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: var(--text-lg);
    margin: 0;
    color: var(--color-primary-dark);
}

.recipient-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--space-md);
}

.recipient-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.loading-text {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
}

.editor-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.form-label {
    font-weight: 600;
    font-size: var(--text-sm);
    color: var(--color-text);
}

.placeholder-help {
    font-size: var(--text-sm);
}

.placeholder-help code {
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 0.85em;
}

.section-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    background: none;
    border: none;
    cursor: pointer;
    color: inherit;
    padding: 0;
}

.preview-area {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
    margin-top: var(--space-sm);
}

.preview-subject {
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-alt);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
}

.preview-iframe {
    width: 100%;
    min-height: 400px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-md);
    background: white;
}

.newsletter-actions {
    display: flex;
    align-items: center;
    gap: var(--space-md);
}

.send-hint {
    color: var(--color-text-muted);
    font-size: var(--text-sm);
}

/* ─── Campaign Progress ───────────────────────────────────────────── */

.campaign-progress {
    border-left: 4px solid var(--color-primary);
}

.progress-wrapper {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.progress-bar {
    display: flex;
    height: 24px;
    background: var(--color-bg-alt);
    border-radius: var(--radius-md);
    overflow: hidden;
}

.progress-fill {
    height: 100%;
    transition: width 0.5s ease;
}

.progress-sent {
    background: var(--color-success, #22c55e);
}

.progress-failed {
    background: var(--color-error, #ef4444);
}

.progress-label {
    font-size: var(--text-sm);
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
}

.rate-limit-hint {
    color: var(--color-warning, #f59e0b);
    font-weight: 600;
}

.result-badges {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
}

.campaign-status {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    font-size: var(--text-sm);
}

.campaign-status .status-time {
    color: var(--color-text-muted);
}

.status-completed { color: var(--color-success, #22c55e); font-weight: 600; }
.status-sending, .status-resuming { color: var(--color-primary); font-weight: 600; }
.status-rate-limited { color: var(--color-warning, #f59e0b); font-weight: 600; }
.status-stopped, .status-aborted { color: var(--color-text-muted); font-weight: 600; }
.status-error { color: var(--color-error, #ef4444); font-weight: 600; }

.campaign-actions {
    display: flex;
    gap: var(--space-md);
}

.result-errors {
    margin-top: var(--space-sm);
}

.result-errors h3 {
    font-size: var(--text-sm);
    margin: 0 0 var(--space-xs);
    color: var(--color-error);
}

.result-errors ul {
    margin: 0;
    padding-left: var(--space-lg);
    font-size: var(--text-sm);
}

@media (max-width: 768px) {
    .recipient-grid {
        grid-template-columns: 1fr;
    }
}
</style>
