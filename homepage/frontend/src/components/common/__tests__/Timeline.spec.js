import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Timeline from '../Timeline.vue';

describe('Timeline.vue', () => {
    const items = [
        { date: '2024-01-01T00:00:00Z', label: 'Step 1', status: 'done' },
        { date: '2024-02-01T00:00:00Z', label: 'Step 2', status: 'active' },
        { date: '2024-03-01T00:00:00Z', label: 'Step 3', status: 'upcoming' }
    ];

    it('renders the correct number of items', () => {
        const wrapper = mount(Timeline, {
            props: { items }
        });
        const timelineItems = wrapper.findAll('.timeline-item');
        expect(timelineItems.length).toBe(3);
    });

    it('applies correct status classes to items', () => {
        const wrapper = mount(Timeline, {
            props: { items }
        });
        const timelineItems = wrapper.findAll('.timeline-item');
        
        expect(timelineItems[0].classes()).toContain('done');
        expect(timelineItems[1].classes()).toContain('active');
        expect(timelineItems[2].classes()).toContain('upcoming');
    });

    it('renders the correct icons based on status', () => {
        const wrapper = mount(Timeline, {
            props: { items }
        });
        const dots = wrapper.findAll('.dot-icon');
        
        expect(dots[0].text()).toBe('✓');
        expect(dots[1].text()).toBe('●');
        expect(dots[2].text()).toBe('○');
    });

    it('applies staggered animation delays', () => {
        const wrapper = mount(Timeline, {
            props: { items }
        });
        const timelineItems = wrapper.findAll('.timeline-item');
        
        // Vue Test Utils might return style as CSSStyleDeclaration or a string depending on jsdom version
        // We'll check the element's inline style directly
        expect(timelineItems[0].element.style.animationDelay).toBe('0s');
        expect(timelineItems[1].element.style.animationDelay).toBe('0.15s');
        expect(timelineItems[2].element.style.animationDelay).toBe('0.3s');
    });
});
