import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../services/api.js';

export const useProjectsStore = defineStore('projects', () => {
    const projects = ref([]);
    const currentProject = ref(null);
    const loading = ref(false);
    const loaded = ref(false);

    const fetchProjects = async () => {
        if (loaded.value) return;
        loading.value = true;
        try {
            projects.value = await api.get('/projects');
            loaded.value = true;
        } finally {
            loading.value = false;
        }
    };

    const fetchProject = async (slug) => {
        loading.value = true;
        try {
            currentProject.value = await api.get(`/projects/${slug}`);
            return currentProject.value;
        } finally {
            loading.value = false;
        }
    };

    return { projects, currentProject, loading, loaded, fetchProjects, fetchProject };
});
