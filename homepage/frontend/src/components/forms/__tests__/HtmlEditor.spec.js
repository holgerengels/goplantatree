import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import HtmlEditor from '../HtmlEditor.vue';

// Mock Monaco Editor component
vi.mock('@guolao/vue-monaco-editor', () => ({
  VueMonacoEditor: {
    name: 'VueMonacoEditor',
    props: ['value', 'options', 'language', 'theme', 'height'],
    emits: ['update:value', 'change', 'mount'],
    template: '<div class="monaco-mock" @input="$emit(\'change\', $event.target.value)"></div>'
  }
}));

describe('HtmlEditor.vue', () => {
  it('renders toolbar and options in html mode', () => {
    const wrapper = mount(HtmlEditor, {
      props: {
        modelValue: '<p>Test</p>',
        language: 'html'
      }
    });

    expect(wrapper.find('.html-editor-toolbar').exists()).toBe(true);
    expect(wrapper.find('.toolbar-select').exists()).toBe(true);
    expect(wrapper.find('.macro-reference').exists()).toBe(true);
  });

  it('hides toolbar and macro reference in json mode', () => {
    const wrapper = mount(HtmlEditor, {
      props: {
        modelValue: '{}',
        language: 'json'
      }
    });

    expect(wrapper.find('.html-editor-toolbar').exists()).toBe(false);
    expect(wrapper.find('.macro-reference').exists()).toBe(false);
  });

  it('emits update:modelValue when content changes', async () => {
    const wrapper = mount(HtmlEditor, {
      props: {
        modelValue: '',
        language: 'html'
      }
    });

    const monacoComponent = wrapper.findComponent({ name: 'VueMonacoEditor' });
    monacoComponent.vm.$emit('change', '<h1>Title</h1>');

    expect(wrapper.emitted('update:modelValue')).toBeTruthy();
    expect(wrapper.emitted('update:modelValue')[0]).toEqual(['<h1>Title</h1>']);
  });
});
