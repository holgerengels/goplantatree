import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import RichTextEditor from '../RichTextEditor.vue';

describe('RichTextEditor.vue with Tiptap', () => {
  it('renders WYSIWYG mode by default and shows HTML toggle button', () => {
    const wrapper = mount(RichTextEditor, {
      props: {
        modelValue: '<p>Test</p>'
      }
    });

    expect(wrapper.find('.tiptap-wrapper').exists()).toBe(true);
    expect(wrapper.find('.source-editor').exists()).toBe(false);
    expect(wrapper.find('.btn-toggle-source').text()).toContain('HTML');
  });

  it('switches to source code mode on toggle button click', async () => {
    const wrapper = mount(RichTextEditor, {
      props: {
        modelValue: '<p>Hello World</p>'
      }
    });

    const toggleBtn = wrapper.find('.btn-toggle-source');
    await toggleBtn.trigger('click');

    expect(wrapper.find('.source-editor').exists()).toBe(true);
    const textarea = wrapper.find('.source-editor');
    expect(textarea.element.value).toBe('<p>Hello World</p>');
  });

  it('allows entering raw HTML with < and > in source mode without quoting', async () => {
    const wrapper = mount(RichTextEditor, {
      props: {
        modelValue: ''
      }
    });

    await wrapper.find('.btn-toggle-source').trigger('click');

    const textarea = wrapper.find('.source-editor');
    await textarea.setValue('<div><span>Test</span></div>');

    const emitted = wrapper.emitted('update:modelValue');
    expect(emitted).toBeTruthy();
    const lastEmitted = emitted[emitted.length - 1][0];
    expect(lastEmitted).toBe('<div><span>Test</span></div>');
    expect(lastEmitted).not.toContain('&lt;');
    expect(lastEmitted).not.toContain('&gt;');
  });
});
