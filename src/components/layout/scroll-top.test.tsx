import { render, renderHook } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import { Text } from '@/components/ui/text';

import { Screen } from './screen';
import { ScrollTopProvider, ScrollToTop, useScrollTop } from './scroll-top';

describe('ScrollToTop', () => {
  it('scrolls the enclosing screen once on mount, not on re-render', async () => {
    const scrollTop = jest.fn();
    const ui = (label: string) => (
      <ScrollTopProvider scrollTop={scrollTop}>
        <Text>{label}</Text>
        <ScrollToTop />
      </ScrollTopProvider>
    );
    const { rerender } = await render(ui('first'));
    expect(scrollTop).toHaveBeenCalledTimes(1);
    await rerender(ui('second'));
    expect(scrollTop).toHaveBeenCalledTimes(1);
  });

  it('does nothing outside a provider', async () => {
    const { getByText } = await render(
      <>
        <Text>outcome</Text>
        <ScrollToTop />
      </>,
    );
    expect(getByText('outcome')).toBeOnTheScreen();
  });

  it('is a no-op while the scroll view is not mounted', async () => {
    const { result } = await renderHook(() => useScrollTop());
    expect(() => result.current.scrollTop()).not.toThrow();
  });

  it('scrolls the ScrollView of Screen to the top without animation', async () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    try {
      await render(
        <Screen>
          <ScrollToTop />
        </Screen>,
      );
      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
    } finally {
      scrollTo.mockRestore();
    }
  });
});
