import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Step6Verify } from '../components/wizard/WizardSteps456';

describe('Step6Verify', () => {
  it('shows verification in progress instead of a success state while checks are running', () => {
    render(
      <Step6Verify
        routerName="Router 1"
        serviceType="pppoe"
        vpnEnabled={false}
        vpnMode="hybrid"
        vpnSecrets={[]}
        serviceVerifyStatus="checking"
        vpnVerifyStatus="checking"
        onGoBack={() => {}}
        onFinish={() => {}}
      />
    );

    expect(screen.getByText(/verifying service configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/checking pppoe service/i)).toBeInTheDocument();
    expect(screen.queryByText(/All Systems Go!/i)).not.toBeInTheDocument();
  });

  it('renders the hotspot-only verification label and success state', () => {
    render(
      <Step6Verify
        routerName="Router 1"
        serviceType="hotspot"
        vpnEnabled={false}
        vpnMode="hybrid"
        vpnSecrets={[]}
        serviceVerifyStatus="success"
        vpnVerifyStatus="success"
        onGoBack={() => {}}
        onFinish={() => {}}
      />
    );

    expect(screen.getByText(/Hotspot Server Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Configuration Successful/i)).toBeInTheDocument();
    expect(screen.getByText(/All Systems Go!/i)).toBeInTheDocument();
  });

  it('renders the combined PPPoE and hotspot verification label for both-services mode', () => {
    render(
      <Step6Verify
        routerName="Router 1"
        serviceType="both"
        vpnEnabled={false}
        vpnMode="hybrid"
        vpnSecrets={[]}
        serviceVerifyStatus="success"
        vpnVerifyStatus="success"
        onGoBack={() => {}}
        onFinish={() => {}}
      />
    );

    expect(screen.getByText(/PPPoE & Hotspot Status/i)).toBeInTheDocument();
    expect(screen.getByText(/Configuration Successful/i)).toBeInTheDocument();
    expect(screen.getByText(/All Systems Go!/i)).toBeInTheDocument();
  });

  it('shows failed verification state when service check fails', () => {
    render(
      <Step6Verify
        routerName="Router 1"
        serviceType="hotspot"
        vpnEnabled={false}
        vpnMode="hybrid"
        vpnSecrets={[]}
        serviceVerifyStatus="failed"
        vpnVerifyStatus="success"
        onGoBack={() => {}}
        onFinish={() => {}}
      />
    );

    expect(screen.getAllByText(/Configuration Failed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Services not found on router/i)).toBeInTheDocument();
    expect(screen.queryByText(/All Systems Go!/i)).not.toBeInTheDocument();
  });
});
