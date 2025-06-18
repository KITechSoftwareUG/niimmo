
import { Calendar, Building2, Settings, User, LayoutDashboard } from "lucide-react";

export const DashboardSidebar = () => {
  return (
    <div className="w-80 sidebar-card border-r border-gray-100 h-screen overflow-y-auto">
      {/* Logo Section */}
      <div className="p-8 border-b border-gray-100">
        <div className="flex items-center space-x-3 mb-6">
          <img 
            src="/lovable-uploads/c3157d5e-324c-4af6-82c4-55456f4ea211.png" 
            alt="NiImmo Gruppe Logo" 
            className="h-12 w-auto"
          />
          <div>
            <h2 className="text-xl font-display font-bold text-gray-800">NiImmo</h2>
            <p className="text-sm text-gray-500">Immobilien Gruppe</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-6">
        <nav className="space-y-2">
          <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-xl accent-red text-white font-medium">
            <LayoutDashboard className="h-5 w-5" />
            <span>Dashboard</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            <Calendar className="h-5 w-5" />
            <span>Kalender</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            <Building2 className="h-5 w-5" />
            <span>Immobilien</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            <User className="h-5 w-5" />
            <span>Mieter</span>
          </a>
          <a href="#" className="flex items-center space-x-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            <Settings className="h-5 w-5" />
            <span>Einstellungen</span>
          </a>
        </nav>
      </div>

      {/* Quick Calendar */}
      <div className="p-6 border-t border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          {new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="calendar-grid mb-4">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(day => (
            <div key={day} className="text-xs font-medium text-gray-500 text-center py-2">
              {day}
            </div>
          ))}
          {Array.from({ length: 35 }, (_, i) => {
            const day = i - 6; // Start from previous month
            const isToday = day === new Date().getDate() && i > 6 && i < 28;
            const isCurrentMonth = i > 6 && i < 28;
            
            return (
              <div 
                key={i} 
                className={`calendar-cell text-xs flex items-center justify-center rounded ${
                  isToday ? 'today' : 
                  isCurrentMonth ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300'
                }`}
              >
                {day > 0 && day <= 31 ? day : ''}
              </div>
            );
          })}
        </div>
      </div>

      {/* Profile Section */}
      <div className="p-6 border-t border-gray-100">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl accent-red-light flex items-center justify-center">
            <User className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-800">Admin User</h4>
            <p className="text-sm text-gray-500">Immobilien Manager</p>
          </div>
        </div>
      </div>
    </div>
  );
};
