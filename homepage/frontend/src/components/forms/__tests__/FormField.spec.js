import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import FormField from '../FormField.vue';

describe('FormField.vue', () => {
    it('renders a wa-input for text field', () => {
        const wrapper = mount(FormField, {
            props: {
                field: { name: 'title', label: 'Titel', type: 'Text' },
                modelValue: 'Initial Title',
                useWebAwesome: true
            }
        });

        const input = wrapper.find('wa-input');
        expect(input.exists()).toBe(true);
        expect(input.attributes('label')).toBe('Titel');
        expect(input.attributes('value')).toBe('Initial Title');
    });

    it('emits update:modelValue on input event for wa-input', async () => {
        const wrapper = mount(FormField, {
            props: {
                field: { name: 'title', label: 'Titel', type: 'Text' },
                modelValue: '',
                useWebAwesome: true
            }
        });

        const input = wrapper.find('wa-input');
        
        // Simulate native input event that WebAwesome emits
        input.element.value = 'New Value';
        await input.trigger('input');

        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0]).toEqual(['New Value']);
    });

    it('renders wa-select for Select field and emits change', async () => {
        const wrapper = mount(FormField, {
            props: {
                field: { 
                    name: 'status', 
                    label: 'Status', 
                    type: 'Select',
                    options: ['Draft', 'Published']
                },
                modelValue: 'Draft',
                useWebAwesome: true
            }
        });

        const select = wrapper.find('wa-select');
        expect(select.exists()).toBe(true);
        expect(select.attributes('value')).toBe('Draft');

        // Simulate change event
        select.element.value = 'Published';
        await select.trigger('change');

        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0]).toEqual(['Published']);
    });

    it('renders wa-checkbox for Boolean field and emits change', async () => {
        const wrapper = mount(FormField, {
            props: {
                field: { name: 'active', label: 'Aktiv', type: 'Boolean' },
                modelValue: false,
                useWebAwesome: true
            }
        });

        const checkbox = wrapper.find('wa-checkbox');
        expect(checkbox.exists()).toBe(true);
        expect(checkbox.attributes('checked')).toBe('false'); 

        // Simulate change event
        checkbox.element.checked = true;
        await checkbox.trigger('change');

        const emitted = wrapper.emitted('update:modelValue');
        expect(emitted).toBeTruthy();
        expect(emitted[0]).toEqual([true]);
    });

    it('binds disabled attribute conditionally based on readonly', () => {
        const wrapperReadonly = mount(FormField, {
            props: {
                field: { name: 'title', label: 'Titel', type: 'Text', readonly: true },
                modelValue: '',
                useWebAwesome: true
            }
        });
        expect(wrapperReadonly.find('wa-input').attributes('disabled')).toBe('true');

        const wrapperEditable = mount(FormField, {
            props: {
                field: { name: 'title', label: 'Titel', type: 'Text', readonly: false },
                modelValue: '',
                useWebAwesome: true
            }
        });
        // disabled attribute should be undefined/not present
        expect(wrapperEditable.find('wa-input').attributes('disabled')).toBeUndefined();
    });
});
