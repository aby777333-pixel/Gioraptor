import { createClient } from '@/lib/supabase/client';

export const orderService = {
  async placeMarketOrder(params: {
    accountId: string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    size: number;
    sl?: number;
    tp?: number;
    fillPrice: number;
    comment?: string;
  }) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('place_market_order', {
      p_account_id: params.accountId,
      p_symbol: params.symbol,
      p_direction: params.direction,
      p_size: params.size,
      p_sl: params.sl ?? null,
      p_tp: params.tp ?? null,
      p_fill_price: params.fillPrice,
      p_comment: params.comment ?? null,
    });
    if (error) throw error;
    return data;
  },

  async closePosition(positionId: string, closePrice: number) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('close_position', {
      p_position_id: positionId,
      p_close_price: closePrice,
    });
    if (error) throw error;
    return data;
  },

  async modifyPosition(positionId: string, sl?: number, tp?: number) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('modify_position', {
      p_position_id: positionId,
      p_sl: sl ?? null,
      p_tp: tp ?? null,
    });
    if (error) throw error;
    return data;
  },

  async placePendingOrder(params: {
    accountId: string;
    symbol: string;
    direction: 'BUY' | 'SELL';
    orderType: 'limit' | 'stop';
    size: number;
    price: number;
    sl?: number;
    tp?: number;
    comment?: string;
  }) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('place_pending_order', {
      p_account_id: params.accountId,
      p_symbol: params.symbol,
      p_direction: params.direction,
      p_order_type: params.orderType,
      p_size: params.size,
      p_price: params.price,
      p_sl: params.sl ?? null,
      p_tp: params.tp ?? null,
      p_comment: params.comment ?? null,
    });
    if (error) throw error;
    return data;
  },

  async cancelOrder(orderId: string) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('cancel_order', {
      p_order_id: orderId,
    });
    if (error) throw error;
    return data;
  },

  async getAccountSummary(accountId: string) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_account_summary', {
      p_account_id: accountId,
    });
    if (error) throw error;
    return data;
  },

  async getOpenPositions(accountId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getPendingOrders(accountId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'pending_validation')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async getTradeHistory(accountId: string, limit = 50) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('positions')
      .select('*')
      .eq('account_id', accountId)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  },
};
