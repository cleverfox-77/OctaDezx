import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, CheckCircle, AlertTriangle, MessageSquare, ArrowLeft, TrendingUp, TrendingDown, DollarSign, Clock, Activity, Calendar, Download, BarChart3, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TotalSessionsDetail from '@/components/TotalSessionsDetail';
import ResolvedSessionsDetail from '@/components/ResolvedSessionsDetail';
import ActiveSessionsDetail from '@/components/ActiveSessionsDetail';
import EscalatedSessionsDetail from '@/components/EscalatedSessionsDetail';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsProps {
  businessId: string;
}

interface AnalyticsData {
  totalSessions: number;
  resolvedSessions: number;
  activeSessions: number;
  escalatedSessions: number;
  totalOrders: number;
  revenue: number;
  avgResponseTime: number;
  satisfactionRate: number;
}

interface TimeSeriesData {
  date: string;
  sessions: number;
  orders: number;
  revenue: number;
}

interface GrowthMetrics {
  sessionsGrowth: number;
  ordersGrowth: number;
  revenueGrowth: number;
  satisfactionGrowth: number;
}

type MetricType = 'total' | 'resolved' | 'active' | 'escalated' | null;
type TimeRange = '7d' | '30d' | '90d' | 'all';

const Analytics: React.FC<AnalyticsProps> = ({ businessId }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [growthMetrics, setGrowthMetrics] = useState<GrowthMetrics | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const getDateRange = (range: TimeRange) => {
    const now = new Date();
    const start = new Date();

    switch (range) {
      case '7d':
        start.setDate(now.getDate() - 7);
        break;
      case '30d':
        start.setDate(now.getDate() - 30);
        break;
      case '90d':
        start.setDate(now.getDate() - 90);
        break;
      case 'all':
        start.setFullYear(2020);
        break;
    }

    return { start, end: now };
  };

  const fetchAnalytics = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const { start, end } = getDateRange(timeRange);

      // Fetch sessions data
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('id, status, created_at')
        .eq('business_id', businessId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (sessionsError) throw sessionsError;

      // Fetch REAL orders data
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .eq('business_id', businessId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (ordersError) throw ordersError;

      // Fetch messages for response time calculation
      const sessionIds = sessions?.map(s => s.id) || [];
      let messages: any[] = [];
      if (sessionIds.length > 0) {
        const { data: messagesData } = await supabase
          .from('chat_messages')
          .select('session_id, sender_type, created_at')
          .in('session_id', sessionIds)
          .order('created_at', { ascending: true });
        messages = messagesData || [];
      }

      // Calculate session metrics
      const totalSessions = sessions?.length || 0;
      const resolvedSessions = sessions?.filter(s => s.status === 'resolved').length || 0;
      const activeSessions = sessions?.filter(s => s.status === 'active').length || 0;
      const escalatedSessions = sessions?.filter(s => s.status === 'escalated').length || 0;

      // Real order metrics
      const totalOrders = orders?.length || 0;
      const revenue = orders?.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0) || 0;

      // Calculate average response time
      let avgResponseTime = 0;
      if (messages.length > 1) {
        const responseTimes: number[] = [];
        const groupedBySession = messages.reduce((acc: any, msg: any) => {
          if (!acc[msg.session_id]) acc[msg.session_id] = [];
          acc[msg.session_id].push(msg);
          return acc;
        }, {});

        Object.values(groupedBySession).forEach((sessionMsgs: any) => {
          for (let i = 1; i < sessionMsgs.length; i++) {
            if (sessionMsgs[i].sender_type === 'ai' && sessionMsgs[i-1].sender_type === 'customer') {
              const time1 = new Date(sessionMsgs[i-1].created_at).getTime();
              const time2 = new Date(sessionMsgs[i].created_at).getTime();
              responseTimes.push((time2 - time1) / 1000);
            }
          }
        });

        avgResponseTime = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;
      }

      // Satisfaction rate based on resolved sessions
      const satisfactionRate = totalSessions > 0
        ? Math.min(95, 70 + (resolvedSessions / totalSessions) * 25)
        : 0;

      setData({
        totalSessions,
        resolvedSessions,
        activeSessions,
        escalatedSessions,
        totalOrders,
        revenue,
        avgResponseTime,
        satisfactionRate
      });

      // Generate time series data with REAL order data
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 180;
      const newTimeSeriesData: TimeSeriesData[] = [];

      for (let i = days - 1; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        const daySessions = sessions?.filter(s => {
          const sessionDate = new Date(s.created_at);
          return sessionDate.toDateString() === date.toDateString();
        }).length || 0;

        const dayOrders = orders?.filter(o => {
          const orderDate = new Date(o.created_at);
          return orderDate.toDateString() === date.toDateString();
        }) || [];

        const dayRevenue = dayOrders.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0);

        newTimeSeriesData.push({
          date: dateStr,
          sessions: daySessions,
          orders: dayOrders.length,
          revenue: dayRevenue
        });
      }

      setTimeSeriesData(newTimeSeriesData);

      // Calculate growth metrics
      const prevStart = new Date(start);
      const prevEnd = new Date(end);
      const periodDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      prevStart.setDate(prevStart.getDate() - periodDays);
      prevEnd.setDate(prevEnd.getDate() - periodDays);

      const { data: prevSessions } = await supabase
        .from('chat_sessions')
        .select('id, status')
        .eq('business_id', businessId)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString());

      const { data: prevOrders } = await supabase
        .from('orders')
        .select('id, total_amount')
        .eq('business_id', businessId)
        .gte('created_at', prevStart.toISOString())
        .lte('created_at', prevEnd.toISOString());

      const prevTotal = prevSessions?.length || 0;
      const prevOrderCount = prevOrders?.length || 0;
      const prevRevenue = prevOrders?.reduce((sum, o) => sum + (parseFloat(o.total_amount) || 0), 0) || 0;

      setGrowthMetrics({
        sessionsGrowth: prevTotal > 0 ? ((totalSessions - prevTotal) / prevTotal) * 100 : (totalSessions > 0 ? 100 : 0),
        ordersGrowth: prevOrderCount > 0 ? ((totalOrders - prevOrderCount) / prevOrderCount) * 100 : (totalOrders > 0 ? 100 : 0),
        revenueGrowth: prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : (revenue > 0 ? 100 : 0),
        satisfactionGrowth: 2.5
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  }, [businessId, timeRange]);

  // Initial fetch
  useEffect(() => {
    if (businessId) {
      fetchAnalytics(true);
    }
  }, [businessId, timeRange, fetchAnalytics]);

  // Real-time updates - NO PAGE RELOAD, just refetch data
  useEffect(() => {
    if (!businessId) return;

    const sessionsChannel = supabase
      .channel('analytics-sessions')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_sessions', filter: `business_id=eq.${businessId}` },
        () => {
          console.log('📊 Real-time: Session update detected');
          fetchAnalytics(false);
        }
      )
      .subscribe();

    const ordersChannel = supabase
      .channel('analytics-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` },
        () => {
          console.log('📊 Real-time: Order update detected');
          fetchAnalytics(false);
        }
      )
      .subscribe();

    const messagesChannel = supabase
      .channel('analytics-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        () => {
          console.log('📊 Real-time: Message update detected');
          fetchAnalytics(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [businessId, fetchAnalytics]);

  const handleMetricSelect = (metric: MetricType) => {
    setSelectedMetric(metric);
  };

  const renderDetailView = () => {
    switch (selectedMetric) {
      case 'total':
        return <TotalSessionsDetail businessId={businessId} />;
      case 'resolved':
        return <ResolvedSessionsDetail businessId={businessId} />;
      case 'active':
        return <ActiveSessionsDetail businessId={businessId} />;
      case 'escalated':
        return <EscalatedSessionsDetail businessId={businessId} />;
      default:
        return null;
    }
  };

  const exportData = () => {
    const csvContent = [
      ['Date', 'Sessions', 'Orders', 'Revenue'],
      ...timeSeriesData.map(d => [d.date, d.sessions, d.orders, d.revenue.toFixed(2)])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Could not load analytics data.</p>
      </div>
    );
  }

  if (selectedMetric) {
    return (
      <div>
        <Button variant="outline" size="sm" onClick={() => handleMetricSelect(null)} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Overview
        </Button>
        {renderDetailView()}
      </div>
    );
  }

  const COLORS = ['#10b981', '#3b82f6', '#ef4444', '#f59e0b'];

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time insights • Last updated: {lastUpdate ? lastUpdate.toLocaleTimeString() : 'Loading...'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
            <SelectTrigger className="w-[140px] sm:w-[160px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={exportData}>
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <Button variant="ghost" size="sm" onClick={() => fetchAnalytics(false)}>
            <Activity className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        <span>Live updates enabled</span>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card
          onClick={() => handleMetricSelect('total')}
          className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Sessions</CardTitle>
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-2xl sm:text-3xl font-bold text-blue-700 dark:text-blue-300">{data.totalSessions}</div>
            {growthMetrics && (
              <p className="text-xs text-muted-foreground flex items-center mt-1 sm:mt-2">
                {growthMetrics.sessionsGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600 mr-1 flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 mr-1 flex-shrink-0" />
                )}
                <span className={growthMetrics.sessionsGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(growthMetrics.sessionsGrowth).toFixed(1)}%
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-2xl sm:text-3xl font-bold text-green-700 dark:text-green-300">{data.totalOrders}</div>
            {growthMetrics && (
              <p className="text-xs text-muted-foreground flex items-center mt-1 sm:mt-2">
                {growthMetrics.ordersGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600 mr-1 flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 mr-1 flex-shrink-0" />
                )}
                <span className={growthMetrics.ordersGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(growthMetrics.ordersGrowth).toFixed(1)}%
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600 dark:text-purple-400" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-2xl sm:text-3xl font-bold text-purple-700 dark:text-purple-300">
              ${data.revenue.toFixed(0)}
            </div>
            {growthMetrics && (
              <p className="text-xs text-muted-foreground flex items-center mt-1 sm:mt-2">
                {growthMetrics.revenueGrowth >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-600 mr-1 flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 mr-1 flex-shrink-0" />
                )}
                <span className={growthMetrics.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(growthMetrics.revenueGrowth).toFixed(1)}%
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Avg Response</CardTitle>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-2xl sm:text-3xl font-bold text-orange-700 dark:text-orange-300">
              {data.avgResponseTime.toFixed(1)}s
            </div>
            <p className="text-xs text-muted-foreground mt-1 sm:mt-2">
              {data.avgResponseTime < 5 ? 'Lightning' : data.avgResponseTime < 15 ? 'Good' : 'Needs work'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card onClick={() => handleMetricSelect('resolved')} className="cursor-pointer hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Resolved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{data.resolvedSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalSessions > 0 ? ((data.resolvedSessions / data.totalSessions) * 100).toFixed(0) : 0}% rate
            </p>
          </CardContent>
        </Card>

        <Card onClick={() => handleMetricSelect('active')} className="cursor-pointer hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Active</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{data.activeSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">In progress</p>
          </CardContent>
        </Card>

        <Card onClick={() => handleMetricSelect('escalated')} className="cursor-pointer hover:shadow-md transition-all">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Escalated</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold">{data.escalatedSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {data.totalSessions > 0 ? ((data.escalatedSessions / data.totalSessions) * 100).toFixed(0) : 0}% rate
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-3 sm:px-6">
            <CardTitle className="text-xs sm:text-sm font-medium">Satisfaction</CardTitle>
            <Activity className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="text-xl sm:text-2xl font-bold text-yellow-700 dark:text-yellow-300">
              {data.satisfactionRate.toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Est. score</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trend" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="trend" className="text-xs sm:text-sm">Trends</TabsTrigger>
          <TabsTrigger value="distribution" className="text-xs sm:text-sm">Distribution</TabsTrigger>
          <TabsTrigger value="performance" className="text-xs sm:text-sm">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="trend" className="space-y-4">
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Sessions & Orders</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Growth and conversion trends</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 pt-4">
              <div className="h-[250px] sm:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timeSeriesData}>
                    <defs>
                      <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#6b7280" fontSize={10} width={30} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Area type="monotone" dataKey="sessions" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSessions)" name="Sessions" />
                    <Area type="monotone" dataKey="orders" stroke="#10b981" fillOpacity={1} fill="url(#colorOrders)" name="Orders" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Revenue Trend</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Daily revenue</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 pt-4">
              <div className="h-[200px] sm:h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#6b7280" fontSize={10} width={40} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Session Status</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Breakdown by status</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 pt-4">
              <div className="h-[250px] sm:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Resolved', value: data.resolvedSessions },
                        { name: 'Active', value: data.activeSessions },
                        { name: 'Escalated', value: data.escalatedSessions },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => percent > 0 ? `${name}: ${(percent * 100).toFixed(0)}%` : ''}
                      outerRadius="70%"
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[data.resolvedSessions, data.activeSessions, data.escalatedSessions].map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-base sm:text-lg">Daily Performance</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Sessions vs Orders</CardDescription>
            </CardHeader>
            <CardContent className="px-2 sm:px-6 pt-4">
              <div className="h-[250px] sm:h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={timeSeriesData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickMargin={8} />
                    <YAxis stroke="#6b7280" fontSize={10} width={30} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="sessions" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Sessions" />
                    <Bar dataKey="orders" fill="#10b981" radius={[4, 4, 0, 0]} name="Orders" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="px-3 sm:px-6 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">
                  {data.totalSessions > 0 ? ((data.totalOrders / data.totalSessions) * 100).toFixed(1) : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Orders / Sessions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-3 sm:px-6 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Avg Order Value</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">
                  ${data.totalOrders > 0 ? (data.revenue / data.totalOrders).toFixed(2) : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Revenue / Orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="px-3 sm:px-6 pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium">Resolution Rate</CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold">
                  {data.totalSessions > 0 ? ((data.resolvedSessions / data.totalSessions) * 100).toFixed(1) : 0}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Resolved / Total</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;
