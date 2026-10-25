import { router } from 'expo-router';
import { act, fireEvent, waitFor } from 'expo-router/testing-library';

import type { Role, WaitlistEntry } from '@/api/types';
import { json, problem, type Handler } from '@/test/fake-fetch';
import { SESSION } from '@/test/fixtures';
import { EST, pack, phase2Instance, requestsTo, waitlistEntry } from '@/test/phase-2-routes';
import { renderApp, type WindowSize } from '@/test/render-app';

const ENTRIES: WaitlistEntry[] = [
  waitlistEntry({ id: 'w-1', customer_display_name: 'Esposito Gennaro', position: 1 }),
  waitlistEntry({
    id: 'w-2',
    customer_display_name: 'Ferrari Giulia',
    zone_id: 'z-2',
    position: 2,
    starts_on: '2026-10-24',
    ends_on: '2026-10-27',
  }),
  waitlistEntry({
    id: 'w-3',
    customer_display_name: 'Russo Paolo',
    status: 'offered',
    position: 0,
  }),
];

const OFFER = {
  id: 'o-1',
  entry_id: 'w-2',
  status: 'pending',
  hold_id: 'h-1',
  spot_id: 's-4',
  spot_label: 'B1',
  cause: 'manual',
  expires_at: '2026-10-25T09:30:00Z',
  created_at: '2026-10-25T08:00:00Z',
};

function waitlistRoutes(extra: Record<string, Handler> = {}): Record<string, Handler> {
  const detail: Record<string, Handler> = {};
  for (const e of ENTRIES)
    detail[`GET ${EST}/waitlist/${e.id}`] = () => json(200, { entry: e, offers: [] });
  return {
    [`GET ${EST}/waitlist`]: (r) => {
      const status = new URL(r.url).searchParams.get('status');
      return json(200, { items: status ? ENTRIES.filter((e) => e.status === status) : ENTRIES });
    },
    [`GET ${EST}/waitlist-settings`]: () =>
      json(200, {
        enabled: true,
        public_join: false,
        auto_offer: true,
        offer_hold_minutes: 90,
        version: 1,
      }),
    [`GET ${EST}/packs`]: () => json(200, { items: [pack()] }),
    [`POST ${EST}/waitlist/w-1/offer`]: () =>
      json(201, { ...OFFER, entry_id: 'w-1', spot_id: undefined, spot_label: 'A1' }),
    [`POST ${EST}/waitlist/w-2/offer`]: () => json(201, OFFER),
    ...detail,
    ...extra,
  };
}

async function open(
  {
    role = 'cashier',
    extra = {},
    connected = true,
  }: { role?: Role; extra?: Record<string, Handler>; connected?: boolean } = {},
  size: WindowSize = 'phone',
) {
  const instance = phase2Instance({ role, extra: waitlistRoutes(extra) });
  const app = await renderApp({ session: SESSION, routes: instance.routes, size, connected });
  await app.screen.findByText(/Anna · /);
  return app;
}

describe('waitlist', () => {
  it('lists the queue and offers the first compatible spot (phone)', async () => {
    const { screen, network } = await open();
    await act(async () => router.push('/waitlist'));
    expect(await screen.findByRole('button', { name: /^1°, Esposito Gennaro/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^2°, Ferrari Giulia/ })).toBeOnTheScreen();
    expect(screen.queryByText('Russo Paolo')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: /Esposito Gennaro/ }));
    expect(await screen.findByText('Ombrellone e 2 lettini')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'La prima compatibile' })).toBeChecked();
    expect(await screen.findByDisplayValue('90')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: "Invia l'offerta" }));
    expect(await screen.findByText("Inviare l'offerta a Esposito Gennaro?")).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: "Invia l'offerta" }).at(-1)!);
    expect(await screen.findByTestId('offer-done')).toHaveTextContent(
      /Offerta inviata a Esposito Gennaro/,
    );

    const [post] = requestsTo(network.calls, 'POST', `${EST}/waitlist/w-1/offer`);
    expect(post!.headers.get('Idempotency-Key')).toBeTruthy();
    expect(await post!.json()).toEqual({ hold_minutes: 90 });
  });

  it('shows the open offers with their status', async () => {
    const { screen } = await open();
    await act(async () => router.push('/waitlist'));
    await fireEvent.press(await screen.findByRole('button', { name: 'Offerta inviata' }));
    expect(
      await screen.findByRole('button', { name: /Russo Paolo, .*Offerta inviata/ }),
    ).toBeOnTheScreen();
    expect(screen.queryByText('Esposito Gennaro')).toBeNull();
  });

  it('offers a released spot from the map to the compatible requests (tablet)', async () => {
    const { screen, network } = await open({}, 'tablet');
    await act(async () => router.push('/map'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Elenco' }));
    await fireEvent.press(await screen.findByRole('button', { name: /^B1,/ }));
    await fireEvent.press(
      await screen.findByRole('button', { name: "Offri a chi è in lista d'attesa" }),
    );
    // B1 is in zone z-2: Esposito asks for any zone, Ferrari for z-2; both fit the day.
    expect(await screen.findByText(/B1 è libera/)).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('button', { name: /Ferrari Giulia/ }));
    expect(await screen.findByRole('radio', { name: 'B1' })).toBeChecked();
    await fireEvent.press(screen.getByRole('button', { name: "Invia l'offerta" }));
    await fireEvent.press(screen.getAllByRole('button', { name: "Invia l'offerta" }).at(-1)!);
    expect(await screen.findByTestId('offer-done')).toHaveTextContent(/Postazione B1/);
    const [post] = requestsTo(network.calls, 'POST', `${EST}/waitlist/w-2/offer`);
    expect(await post!.json()).toEqual({ spot_id: 's-4', hold_minutes: 90 });
  });

  it('shows the refusal when no spot is free', async () => {
    const { screen } = await open({
      extra: { [`POST ${EST}/waitlist/w-1/offer`]: () => problem(409, 'spot_unavailable') },
    });
    await act(async () =>
      router.push({ pathname: '/waitlist/[entryId]', params: { entryId: 'w-1' } }),
    );
    await fireEvent.press(await screen.findByRole('button', { name: "Invia l'offerta" }));
    await fireEvent.press(screen.getAllByRole('button', { name: "Invia l'offerta" }).at(-1)!);
    expect(
      await screen.findByText('Nessun posto compatibile libero per questa richiesta.'),
    ).toBeOnTheScreen();
  });

  it('rejects a hold outside 5–10080 minutes before sending', async () => {
    const { screen, network } = await open();
    await act(async () =>
      router.push({ pathname: '/waitlist/[entryId]', params: { entryId: 'w-1' } }),
    );
    await fireEvent.changeText(await screen.findByLabelText("Durata dell'offerta (minuti)"), '2');
    await fireEvent.press(screen.getByRole('button', { name: "Invia l'offerta" }));
    expect(await screen.findByText('Da 5 a 10080 minuti (7 giorni).')).toBeOnTheScreen();
    expect(requestsTo(network.calls, 'POST', `${EST}/waitlist/w-1/offer`)).toHaveLength(0);
  });

  it('says when the waitlist is turned off', async () => {
    const { screen } = await open({
      extra: {
        [`GET ${EST}/waitlist-settings`]: () =>
          json(200, {
            enabled: false,
            public_join: false,
            auto_offer: false,
            offer_hold_minutes: 60,
            version: 1,
          }),
      },
    });
    await act(async () => router.push('/waitlist'));
    expect(await screen.findByText("Lista d'attesa disattivata")).toBeOnTheScreen();
  });

  it('is read-only for a viewer', async () => {
    const { screen } = await open({ role: 'viewer' });
    await act(async () =>
      router.push({ pathname: '/waitlist/[entryId]', params: { entryId: 'w-1' } }),
    );
    expect(
      await screen.findByText(
        "Il tuo ruolo può consultare la lista d'attesa ma non inviare offerte.",
      ),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: "Invia l'offerta" })).toBeNull();
  });

  it('is not available offline', async () => {
    const { screen, network, connectivity } = await open();
    await act(async () => connectivity.set(false));
    await act(async () => router.push('/waitlist'));
    expect(await screen.findByText("Lista d'attesa non disponibile offline")).toBeOnTheScreen();
    await waitFor(() =>
      expect(requestsTo(network.calls, 'GET', `${EST}/waitlist`)).toHaveLength(0),
    );
  });

  it('opens from the home on phones', async () => {
    const { screen } = await open();
    await fireEvent.press(await screen.findByRole('button', { name: "Lista d'attesa" }));
    expect(await screen.findByRole('button', { name: /Esposito Gennaro/ })).toBeOnTheScreen();
  });
});
