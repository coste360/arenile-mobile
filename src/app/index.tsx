import { Redirect } from 'expo-router';

import { useSession } from '@/features/session/session-provider';

/** Entry point: paired devices go to the home screen, the others to "Collega". */
export default function Index() {
  const { state } = useSession();
  if (state.status === 'paired') return <Redirect href="/home" />;
  return (
    <Redirect
      href={state.reason ? { pathname: '/connect', params: { reason: state.reason } } : '/connect'}
    />
  );
}
