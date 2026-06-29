<template>
  <div class="order-page">
    <HeroSection :title="project?.name || ''" subtitle="Jeder Baum zählt ..." height="35vh"/>

    <section class="section">
      <div class="container">
        <!-- Order closed -->
        <div v-if="project && !project.active" class="order-closed card">
          <div class="closed-icon">🚫</div>
          <h2>Derzeit kann nicht bestellt werden</h2>
          <p>Der Bestellzeitraum für dieses Projekt ist aktuell nicht aktiv. Siehe Zeitstrahl für weitere Informationen.</p>
          <div v-if="timeline.length" class="order-timeline closed-timeline">
            <div
              v-for="item in timeline"
              :key="item.label"
              :class="['timeline-entry', item.status]"
            >
              <span class="tl-icon">{{ item.status === 'done' ? '✅' : item.status === 'active' ? '🔵' : '⏳' }}</span>
              <span class="tl-date">{{ formatDate(item.date) }}</span>
              <span class="tl-label">{{ item.label }}</span>
            </div>
          </div>
          <router-link :to="`/projekt/${route.params.projectSlug}`" class="btn btn-primary" style="margin-top: var(--space-xl)">
            Zur Projektseite
          </router-link>
        </div>

        <div class="order-wrapper" v-if="project?.active && formConfig && !submitted">
          <div class="order-info card">
            <h3>📋 So funktioniert's</h3>
            <ol>
              <li>Fülle das Formular vollständig aus</li>
              <li>Wähle deinen Wunschbaum</li>
              <li>Du erhältst eine Bestätigungs-E-Mail</li>
              <li>Hole deinen Baum am Ausgabetermin ab</li>
              <li>Pflanze ihn am besten noch am selben Tag ein</li>
            </ol>
            <div v-if="timeline.length" class="order-timeline">
              <div
                v-for="item in timeline"
                :key="item.label"
                :class="['timeline-entry', item.status]"
              >
                <span class="tl-icon">{{ item.status === 'done' ? '✅' : item.status === 'active' ? '🔵' : '⚪' }}</span>
                <span class="tl-date">{{ formatDate(item.date) }}</span>
                <span class="tl-label">{{ item.label }}</span>
              </div>
            </div>
          </div>

          <div class="order-form card">
            <h2>Bestellformular</h2>
            <DynamicForm
              ref="formRef"
              :fields="formConfig.fields"
              :grid="formConfig.grid"
              v-model="orderData"
            />
            <div class="form-actions">
              <button class="btn btn-accent btn-lg" @click="submitOrder" :disabled="submitting">
                {{ submitting ? 'Wird gesendet …' : '🌳 Bestellung aufgeben' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Success state -->
        <div v-if="submitted" class="order-success card">
          <div class="success-icon">🎉</div>
          <h2>Bestellung erfolgreich!</h2>
          <p>Deine Bestellnummer: <strong>{{ orderNumber }}</strong></p>
          <p>Wir melden uns bei dir mit weiteren Details zur Abholung.</p>
          <router-link to="/" class="btn btn-primary">Zur Startseite</router-link>
        </div>

        <p v-if="!formConfig && !submitted" class="loading-text">Formular wird geladen…</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, provide, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import HeroSection from '../components/common/HeroSection.vue';
import DynamicForm from '../components/forms/DynamicForm.vue';
import { useProjectsStore } from '../stores/projects.js';
import { useOrdersStore } from '../stores/orders.js';
import { formatDateLong as formatDate } from '../utils/format.js';
import { useJsonLd } from '../composables/useJsonLd.js';
import { api } from '../services/api.js';

const route = useRoute();
const projectsStore = useProjectsStore();
const ordersStore = useOrdersStore();

const project = computed(() => projectsStore.currentProject);
const formConfig = ref(null);
const orderData = reactive({});
const formRef = ref(null);
const submitting = ref(false);
const submitted = ref(false);
const orderNumber = ref('');

// Provide offerings for dynamic:offerings options in FormField
const offerings = ref([]);
provide('dynamicOfferings', offerings);

const timeline = computed(() => project.value?.content?.timeline || []);

useJsonLd(() => {
    if (!project.value) return null;
    return {
        "@type": "WebPage",
        "name": `Bestellung: ${project.value.name}`,
        "description": "Bestellformular für Bäume.",
        "url": window.location.href
    };
});

const submitOrder = async () => {
    if (!formRef.value.validate()) return;

    submitting.value = true;
    try {
        const result = await ordersStore.submitOrder({
            ...orderData,
            project: project.value.slug
        });
        orderNumber.value = result.orderNumber;
        submitted.value = true;
    } catch (err) {
        if (err.suggestion) {
            if (err.suggestion.street) orderData.street = err.suggestion.street;
            if (err.suggestion.zip) orderData.zip = err.suggestion.zip;
            if (err.suggestion.city) orderData.city = err.suggestion.city;
            
            // Wait for watch on orderData to trigger validate() before we set the warning error message
            nextTick(() => {
                formRef.value.errors = [
                    'Die eingegebene Adresse konnte nicht genau zugeordnet werden. Wir haben Korrekturvorschläge in das Formular eingetragen. Bitte überprüfe die Angaben und klicke erneut auf Bestellen.'
                ];
                nextTick(() => {
                    formRef.value?.$el?.querySelector('.error-messages')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                });
            });
        } else {
            formRef.value.errors = [err.message];
            nextTick(() => {
                formRef.value?.$el?.querySelector('.error-messages')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
            });
        }
    } finally {
        submitting.value = false;
    }
};

onMounted(async () => {
    const slug = route.params.projectSlug;
    await projectsStore.fetchProject(slug);

    // Load available offerings for this project
    try {
        offerings.value = await api.get(`/offerings?project=${slug}&available=true`);
    } catch { /* skip */ }

    // Load form config
    if (project.value?.orderFormConfig) {
        try {
            formConfig.value = await api.get(`/config/${project.value.orderFormConfig}`);
        } catch { /* skip */ }
    }
});
</script>

<style scoped>
.order-wrapper {
    display: grid;
    grid-template-columns: 300px 1fr;
    gap: var(--space-2xl);
    align-items: start;
}

.order-info {
    position: sticky;
    top: calc(var(--header-height, 64px) + var(--space-lg));
}

.order-timeline {
    margin-top: var(--space-md);
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.timeline-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
    padding: 4px 0;
}

.timeline-entry.done {
    color: var(--color-text-muted);
}

.timeline-entry.active {
    color: var(--color-primary-dark);
    font-weight: 600;
}

.tl-icon {
    font-size: 14px;
    flex-shrink: 0;
}

.tl-date {
    font-weight: 600;
    min-width: 80px;
    white-space: nowrap;
}

.tl-label {
    color: var(--color-text-secondary);
}
.order-info ol {
    padding-left: var(--space-lg);
    margin: var(--space-md) 0;
    list-style: decimal;
}
.order-info li {
    margin-bottom: var(--space-sm);
    font-size: var(--text-sm);
    color: var(--color-text-secondary);
}

.order-form {
    padding: var(--space-2xl) !important;
}

.order-form h2 {
    margin-bottom: var(--space-xl);
}

.form-actions {
    margin-top: var(--space-xl);
    text-align: center;
}

.order-success {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
    padding: var(--space-3xl) !important;
}

.success-icon {
    font-size: 4rem;
    margin-bottom: var(--space-lg);
}

.order-success h2 {
    margin-bottom: var(--space-md);
}

.order-success p {
    margin-bottom: var(--space-md);
}

.loading-text {
    text-align: center;
    padding: var(--space-3xl);
    color: var(--color-text-muted);
}

.order-closed {
    max-width: 500px;
    margin: 0 auto;
    text-align: center;
    padding: var(--space-3xl) !important;
}

.closed-icon {
    font-size: 4rem;
    margin-bottom: var(--space-lg);
}

.order-closed h2 {
    margin-bottom: var(--space-md);
}

.order-closed p {
    margin-bottom: var(--space-lg);
    color: var(--color-text-secondary);
}

.closed-timeline {
    text-align: left;
    margin: var(--space-lg) auto;
    max-width: 320px;
}

@media (max-width: 900px) {
    .order-wrapper {
        grid-template-columns: 1fr;
    }
    .order-info {
        position: static;
    }
}
</style>
