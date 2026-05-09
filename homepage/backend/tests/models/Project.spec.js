import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import Project from '../../src/models/Project.js';

describe('Project Model', () => {
    it('should create a project successfully', async () => {
        const projectData = {
            name: 'Test Project',
            slug: 'test-project',
            description: 'A project for testing'
        };
        const project = new Project(projectData);
        const savedProject = await project.save();

        expect(savedProject._id).toBeDefined();
        expect(savedProject.name).toBe(projectData.name);
        expect(savedProject.slug).toBe(projectData.slug);
        expect(savedProject.active).toBe(true); // Default value
    });

    it('should fail to create a project without a required field', async () => {
        const projectData = {
            slug: 'missing-name'
        };
        const project = new Project(projectData);

        let err;
        try {
            await project.save();
        } catch (error) {
            err = error;
        }

        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors.name).toBeDefined();
    });

    it('should enforce unique slugs', async () => {
        const projectData = {
            name: 'Duplicate Project',
            slug: 'duplicate'
        };
        const project1 = new Project(projectData);
        await project1.save();

        const project2 = new Project(projectData);

        let err;
        try {
            await project2.save();
        } catch (error) {
            err = error;
        }

        expect(err).toBeDefined();
        expect(err.code).toBe(11000); // MongoDB duplicate key error code
    });
});
