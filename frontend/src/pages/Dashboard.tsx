import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Search, 
  Stethoscope, 
  MapPin, 
  FileText, 
  User, 
  Clock,
  Heart,
  Activity
} from 'lucide-react';

const Dashboard: React.FC = () => {
  const { user } = useAuth();

  const quickActions = [
    {
      icon: <Search className="h-8 w-8 text-blue-500" />,
      title: "Symptom Checker",
      description: "Get AI-powered analysis of your symptoms",
      link: "/symptom-checker",
      color: "bg-blue-50 hover:bg-blue-100"
    },
    {
      icon: <Stethoscope className="h-8 w-8 text-green-500" />,
      title: "Find Treatments",
      description: "Search for medical treatments and procedures",
      link: "/treatments",
      color: "bg-green-50 hover:bg-green-100"
    },
    {
      icon: <MapPin className="h-8 w-8 text-purple-500" />,
      title: "Hospital Finder",
      description: "Locate nearby hospitals and clinics",
      link: "/hospitals",
      color: "bg-purple-50 hover:bg-purple-100"
    },
    {
      icon: <FileText className="h-8 w-8 text-orange-500" />,
      title: "Report Analysis",
      description: "Upload and analyze medical reports",
      link: "/report-analysis",
      color: "bg-orange-50 hover:bg-orange-100"
    }
  ];

  const recentActivity = [
    {
      icon: <Search className="h-5 w-5 text-blue-500" />,
      title: "Symptom check completed",
      time: "2 hours ago",
      description: "Analyzed headache and fatigue symptoms"
    },
    {
      icon: <MapPin className="h-5 w-5 text-purple-500" />,
      title: "Hospital search",
      time: "1 day ago",
      description: "Found 5 cardiology specialists nearby"
    },
    {
      icon: <FileText className="h-5 w-5 text-orange-500" />,
      title: "Report uploaded",
      time: "3 days ago",
      description: "Blood test report analyzed successfully"
    }
  ];

  const healthStats = [
    {
      icon: <Heart className="h-6 w-6 text-red-500" />,
      label: "Consultations",
      value: "12",
      change: "+2 this month"
    },
    {
      icon: <Activity className="h-6 w-6 text-green-500" />,
      label: "Health Score",
      value: "85%",
      change: "+5% improved"
    },
    {
      icon: <FileText className="h-6 w-6 text-blue-500" />,
      label: "Reports",
      value: "8",
      change: "3 pending review"
    },
    {
      icon: <Clock className="h-6 w-6 text-purple-500" />,
      label: "Last Checkup",
      value: "2 weeks",
      change: "Next due in 1 month"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white">
        <div className="flex items-center space-x-4">
          <div className="bg-white bg-opacity-20 p-3 rounded-lg">
            <User className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Welcome back, {user?.name}!</h1>
            <p className="text-primary-100">
              Ready to take charge of your health today?
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => (
            <Link
              key={index}
              to={action.link}
              className={`${action.color} p-6 rounded-lg transition-colors cursor-pointer border border-gray-200`}
            >
              <div className="space-y-4">
                <div className="flex justify-center">
                  {action.icon}
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-gray-900">{action.title}</h3>
                  <p className="text-sm text-gray-600">{action.description}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Health Overview */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Health Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {healthStats.map((stat, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.change}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  {stat.icon}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">Recent Activity</h2>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6 space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="bg-gray-100 p-2 rounded-lg">
                  {activity.icon}
                </div>
                <div className="flex-1 space-y-1">
                  <h4 className="font-medium text-gray-900">{activity.title}</h4>
                  <p className="text-sm text-gray-600">{activity.description}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Health Tips */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Today's Health Tip</h2>
        <div className="flex items-start space-x-4">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Heart className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Stay Hydrated</h3>
            <p className="text-gray-600">
              Drink at least 8 glasses of water daily to maintain optimal health. 
              Proper hydration helps with digestion, temperature regulation, and joint lubrication.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
