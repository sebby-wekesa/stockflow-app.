'use client';

import { DashboardScreen } from './screens/DashboardScreen';
import { ApprovalsScreen } from './screens/ApprovalsScreen';
import { OperatorQueueScreen } from './screens/OperatorQueueScreen';
import { CatalogueScreen } from './screens/CatalogueScreen';
import { PackQueueScreen } from './screens/PackQueueScreen';
import { RawMaterialsScreen } from './screens/RawMaterialsScreen';
import { UsersScreen } from './screens/UsersScreen';

interface DashboardContentProps {
  currentRole: string;
  currentScreen: string;
}

export function DashboardContent({ currentRole, currentScreen }: DashboardContentProps) {
  const renderScreen = () => {
    switch (currentScreen) {
      case 'dashboard':
      case 'manager_dash':
        return <DashboardScreen />;
      case 'approvals':
        return <ApprovalsScreen />;
      case 'operator_queue':
        return <OperatorQueueScreen />;
      case 'catalogue':
        return <CatalogueScreen />;
      case 'pack_queue':
        return <PackQueueScreen />;
      case 'rawmaterials':
        return <RawMaterialsScreen />;
      case 'users':
        return <UsersScreen />;
      default:
        return (
          <div className="card">
            <p style={{color:'var(--muted)'}}>Screen: {currentScreen} (Role: {currentRole})</p>
            <p style={{color:'var(--muted)', fontSize: '13px'}}>This screen is under development.</p>
          </div>
        );
    }
  };

  return (
    <div className="screen active">
      {renderScreen()}
    </div>
  );
}