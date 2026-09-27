import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '../services/api.js';

export const useProjectsStore = defineStore('projects', () => {
    const projects = ref([]);
    const currentProject = ref(null);
    const loading = ref(false);
    const loaded = ref(false);

    let projectsPromise = null;

    const fetchProjects = async () => {
        if (loaded.value) return projects.value;
        if (projectsPromise) return projectsPromise;
        loading.value = true;
        projectsPromise = (async () => {
            try {
                projects.value = await api.get('/projects');
                loaded.value = true;
                return projects.value;
            } finally {
                loading.value = false;
                projectsPromise = null;
            }
        })();
        return projectsPromise;
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
