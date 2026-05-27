import { describe, it, expect } from 'vitest';
import { evaluateExpression, evaluateFields, validateFields, applyPermissionsToFields } from '../evaluation.js';

describe('Evaluation Utils', () => {
    describe('evaluateExpression', () => {
        it('should return original string if not a template', () => {
            expect(evaluateExpression('hello', {})).toBe('hello');
        });

        it('should evaluate simple javascript expressions', () => {
            expect(evaluateExpression('{{ 1 + 1 }}', {})).toBe(2);
        });

        it('should evaluate expressions with data context', () => {
            expect(evaluateExpression('{{ age > 18 }}', { age: 20 })).toBe(true);
            expect(evaluateExpression('{{ age > 18 }}', { age: 15 })).toBe(false);
        });

        it('should handle undefined variables gracefully by throwing error and returning original string', () => {
            // "nonExistent" is not defined, new Function will throw reference error
            expect(evaluateExpression('{{ nonExistent === true }}', {})).toBe('{{ nonExistent === true }}');
        });
    });

    describe('evaluateFields', () => {
        const fields = [
            { name: 'name', label: 'Name', required: true },
            { name: 'age', label: 'Age', visible: '{{ role === "admin" }}' },
            { name: 'readonlyField', label: 'Readonly', readonly: '{{ status === "locked" }}' }
        ];

        it('should evaluate visible correctly based on context', () => {
            const evaluatedAdmin = evaluateFields(fields, { role: 'admin' });
            expect(evaluatedAdmin[1].visible).toBe(true);

            const evaluatedUser = evaluateFields(fields, { role: 'user' });
            expect(evaluatedUser[1].visible).toBe(false);
        });

        it('should evaluate readonly correctly based on context', () => {
            const evaluatedLocked = evaluateFields(fields, { status: 'locked' });
            expect(evaluatedLocked[2].readonly).toBe(true);

            const evaluatedOpen = evaluateFields(fields, { status: 'open' });
            expect(evaluatedOpen[2].readonly).toBe(false);
        });
    });

    describe('validateFields', () => {
        const fields = [
            { name: 'username', label: 'Benutzername', required: true },
            { name: 'age', label: 'Alter', required: '{{ type === "adult" }}' },
            { name: 'hidden', label: 'Versteckt', required: true, visible: false },
            { name: 'email', label: 'E-Mail', validation: { expression: 'email.includes("@")', message: 'Ungültige E-Mail' } }
        ];

        it('should return valid if all required fields are filled', () => {
            const data = { username: 'testuser', type: 'child', email: 'test@test.com' };
            const result = validateFields(data, fields);
            expect(result.isValid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should fail if static required field is missing', () => {
            const data = { type: 'child', email: 'test@test.com' };
            const result = validateFields(data, fields);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Benutzername ist ein Pflichtfeld');
        });

        it('should ignore validation for invisible fields', () => {
            // 'hidden' is required but visible: false, so it shouldn't trigger error
            const data = { username: 'testuser', type: 'child' };
            const result = validateFields(data, fields);
            expect(result.isValid).toBe(true);
        });

        it('should evaluate dynamic required rule correctly', () => {
            // Adult requires age
            const dataAdult = { username: 'testuser', type: 'adult' };
            const resultAdult = validateFields(dataAdult, fields);
            expect(resultAdult.isValid).toBe(false);
            expect(resultAdult.errors).toContain('Alter ist ein Pflichtfeld');

            // Child does not require age
            const dataChild = { username: 'testuser', type: 'child' };
            const resultChild = validateFields(dataChild, fields);
            expect(resultChild.isValid).toBe(true);
        });

        it('should fail custom validation expression', () => {
            const data = { username: 'testuser', type: 'child', email: 'invalid-email' };
            const result = validateFields(data, fields);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Ungültige E-Mail');
        });
    });

    describe('applyPermissionsToFields', () => {
        const fields = [
            { name: 'name', label: 'Name', type: 'Text' },
            { name: 'project', label: 'Projekt', type: 'Relation' }
        ];

        it('should make all fields readonly if scope is none', () => {
            const user = { permissions: { posts: { update: 'none' } } };
            const result = applyPermissionsToFields(fields, user, 'posts', 'update', { project: 'proj1' });
            expect(result[0].readonly).toBe(true);
            expect(result[1].readonly).toBe(true);
        });

        it('should make all fields readonly if scope is own but item belongs to other project', () => {
            const user = { permissions: { posts: { update: 'own' } }, project: 'proj1' };
            const result = applyPermissionsToFields(fields, user, 'posts', 'update', { project: 'proj2' });
            expect(result[0].readonly).toBe(true);
            expect(result[1].readonly).toBe(true);
        });

        it('should only make project field readonly if scope is own and item belongs to user project', () => {
            const user = { permissions: { posts: { update: 'own' } }, project: 'proj1' };
            const result = applyPermissionsToFields(fields, user, 'posts', 'update', { project: 'proj1' });
            expect(result[0].readonly).toBeUndefined(); // or not true
            expect(result[1].readonly).toBe(true);
        });

        it('should only make project field readonly if scope is own on create action', () => {
            const user = { permissions: { posts: { create: 'own' } }, project: 'proj1' };
            const result = applyPermissionsToFields(fields, user, 'posts', 'create', {});
            expect(result[0].readonly).toBeUndefined();
            expect(result[1].readonly).toBe(true);
        });

        it('should not make project field readonly if user has all update permission', () => {
            const user = { permissions: { posts: { update: 'all' } }, project: 'proj1' };
            const result = applyPermissionsToFields(fields, user, 'posts', 'update', { project: 'proj1' });
            expect(result[0].readonly).toBeUndefined();
            expect(result[1].readonly).toBeUndefined();
        });

        it('should handle resource projects where item is the project itself', () => {
            const user = { permissions: { projects: { update: 'own' } }, project: 'proj1' };
            const resultOwn = applyPermissionsToFields(fields, user, 'projects', 'update', { _id: 'proj1' });
            expect(resultOwn[0].readonly).toBeUndefined(); // user can edit their own project
            
            const resultOther = applyPermissionsToFields(fields, user, 'projects', 'update', { _id: 'proj2' });
            expect(resultOther[0].readonly).toBe(true); // user cannot edit other project
        });
    });
});
