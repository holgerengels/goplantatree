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
            <code>{<!-- -->{topic}}</code> — Thema,
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
          {{ sending ? 'Wird versendet…' : 'Newsletter senden' }}
        </wa-button>

        <span v-if="!form.account" class="send-hint">⚠ Bitte Mail-Konto auswählen</span>
        <span v-else-if="!form.subject" class="send-hint">⚠ Betreff eingeben</span>
        <span v-else-if="!form.html" class="send-hint">⚠ Body eingeben</span>
        <span v-else-if="!hasUnsubscribeLink" class="send-hint">⚠ Abmelde-Link fehlt</span>
        <span v-else-if="recipientCount === 0" class="send-hint">⚠ Keine Empfänger:innen</span>
      </div>

      <!-- Result -->
      <div v-if="sendResult" class="card newsletter-section send-result">
        <h2 class="section-title">
          <component :is="icons.CheckCircle" :size="20" />
          Ergebnis
        </h2>
        <div class="result-badges">
          <wa-badge variant="success">{{ sendResult.sent }} gesendet</wa-badge>
          <wa-badge v-if="sendResult.failed > 0" variant="danger">{{ sendResult.failed }} fehlgeschlagen</wa-badge>
          <wa-badge variant="neutral">{{ sendResult.total }} gesamt</wa-badge>
        </div>
        <div v-if="sendResult.errors?.length" class="result-errors">
          <h3>Fehler:</h3>
          <ul>
            <li v-for="(err, i) in sendResult.errors" :key="i">
              {{ err.email }}: {{ err.error }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </AdminLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue';
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
const sendResult = ref(null);
const showPreview = ref(false);
const topics = ref([]);

const form = reactive({
    account: '',
    project: '',
    topic: '',
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

// Preview rendering with example data
const exampleVars = {
    name: 'Max Mustermann',
    email: 'max@example.com',
    project: 'klimabaumaktion-ulm',
    topic: 'general',
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

        const data = await api.get(`/subscribers?${params.toString()}`);
        const items = Array.isArray(data) ? data : (data.items || []);
        recipientCount.value = items.length;
    } catch {
        recipientCount.value = null;
    } finally {
        loadingRecipients.value = false;
    }
};

watch([() => form.project, () => form.topic], () => {
    loadRecipientCount();
});

// Send newsletter
const sendNewsletter = async () => {
    if (!canSend.value) return;

    const ok = await confirm(`Newsletter an ${recipientCount.value} Empfänger:innen senden?\n\nDieser Vorgang kann nicht rückgängig gemacht werden.`);
    if (!ok) return;

    sending.value = true;
    sendResult.value = null;

    try {
        const payload = {
            account: form.account,
            subject: form.subject,
            html: form.html
        };
        if (form.project) payload.project = form.project;
        if (form.topic) payload.topic = form.topic;
        if (form.text) payload.text = form.text;

        const result = await api.post('/mail/send-newsletter', payload);
        sendResult.value = result;

        if (result.failed === 0) {
            toast.success(`✅ Newsletter an ${result.sent} Empfänger:innen versendet!`);
        } else {
            toast.warning(`Newsletter versendet: ${result.sent} erfolgreich, ${result.failed} fehlgeschlagen.`);
        }
    } catch (err) {
        toast.error('Fehler beim Versand: ' + err.message);
    } finally {
        sending.value = false;
    }
};

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
        topics.value = await api.get('/subscribers/distinct/topic');
    } catch { /* skip */ }

    loadRecipientCount();
});
</script>

<style scoped>
.newsletter-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    max-width: 900px;
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

.send-result {
    border-left: 4px solid var(--color-success);
}

.result-badges {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
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
