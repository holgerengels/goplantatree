<template>
  <div class="order-page">
    <HeroSection title="Baum bestellen" :subtitle="project?.name || ''" height="35vh" badge="Kostenlos" />

    <section class="section">
      <div class="container">
        <div class="order-wrapper" v-if="formConfig && !submitted">
          <div class="order-info card">
            <h3>📋 So funktioniert's</h3>
            <ol>
              <li>Fülle das Formular vollständig aus</li>
              <li>Wähle deinen Wunschbaum</li>
              <li>Du erhältst eine Bestätigungs-E-Mail</li>
              <li>Hole deinen Baum am Ausgabetermin ab</li>
            </ol>
            <p v-if="project?.orderPeriod">
              <strong>Bestellzeitraum:</strong>
              {{ formatDate(project.orderPeriod.start) }} – {{ formatDate(project.orderPeriod.end) }}
            </p>
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
import { ref, reactive, computed, onMounted, provide } from 'vue';
import { useRoute } from 'vue-router';
import HeroSection from '../components/common/HeroSection.vue';
import DynamicForm from '../components/forms/DynamicForm.vue';
import { useProjectsStore } from '../stores/projects.js';
import { useOrdersStore } from '../stores/orders.js';
import { formatDateLong as formatDate } from '../utils/format.js';

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



const submitOrder = async () => {
    if (!formRef.value.validate()) return;

    submitting.value = true;
    try {
        const result = await ordersStore.submitOrder({
            ...orderData,
            project: project.value._id
        });
        orderNumber.value = result.orderNumber;
        submitted.value = true;
    } catch (err) {
        alert(err.message);
    } finally {
        submitting.value = false;
    }
};

onMounted(async () => {
    const slug = route.params.projectSlug;
    await projectsStore.fetchProject(slug);

    // Load available offerings for this project
    const offeringsRes = await fetch(`/api/v1/offerings?project=${slug}&available=true`);
    if (offeringsRes.ok) offerings.value = await offeringsRes.json();

    // Load form config
    if (project.value?.orderFormConfig) {
        const res = await fetch(`/api/v1/config/${project.value.orderFormConfig}`);
        if (res.ok) formConfig.value = await res.json();
    }
});
</script>

<style scoped>
.order-wrapper {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: var(--space-2xl);
    align-items: start;
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

@media (max-width: 768px) {
    .order-wrapper {
        grid-template-columns: 1fr;
    }
}
</style>
