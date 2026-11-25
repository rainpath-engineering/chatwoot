import { getConversationsAPI } from '../../api/conversation';
import { MESSAGE_TYPE } from '../../helpers/constants';

const state = {
  records: [],
  page: 0,
  hasNextPage: false,
  unreadCount: 0,
  // Bumped whenever another thread takes the screen, so late responses can tell they are stale.
  thread: 0,
  // Bumped when setUser switches the visitor, so a list requested for the previous one is dropped.
  identity: 0,
  uiFlags: {
    isFetching: false,
  },
};

const findRecord = ($state, id) =>
  $state.records.find(record => record.id === id);

export const getters = {
  getRecords: $state => $state.records,
  getLatestConversation: $state => $state.records[0],
  getHasNextPage: $state => $state.hasNextPage,
  getIsFetching: $state => $state.uiFlags.isFetching,
  // The conversation on screen reports its own unread state from the thread.
  getUnreadCount: ($state, _getters, rootState) => {
    const active = findRecord($state, rootState.conversationAttributes.id);
    return $state.unreadCount - (active?.unread_count > 0 ? 1 : 0);
  },
};

export const actions = {
  fetch: async ({ state: listState, commit }, { page = 1 } = {}) => {
    const { identity } = listState;
    commit('setFetching', true);
    try {
      const {
        data: { payload, meta },
      } = await getConversationsAPI({ page });
      if (listState.identity !== identity) return;
      commit('setRecords', {
        payload,
        page,
        hasNextPage: meta.has_next_page,
        unreadCount: meta.unread_count,
      });
    } catch (error) {
      // Ignore error
    } finally {
      if (listState.identity === identity) commit('setFetching', false);
    }
  },

  fetchMore: ({ state: listState, dispatch }) => {
    if (!listState.hasNextPage || listState.uiFlags.isFetching) return;
    dispatch('fetch', { page: listState.page + 1 });
  },

  // Records are newest-activity first, so the first match is the most recent one.
  load: async ({ state: listState, dispatch }) => {
    await dispatch('startNew');
    const { thread } = listState;
    await dispatch('fetch');
    if (listState.thread !== thread) return;
    const conversation =
      listState.records.find(record => record.status !== 'resolved') ||
      listState.records[0];
    if (conversation) await dispatch('open', conversation.id);
  },

  // Reopening the conversation on screen retries its first page when that load failed, offline
  // for instance; otherwise it would stay empty until a socket reconnect happened to catch up.
  open: async (
    { state: listState, commit, dispatch, rootState, rootGetters },
    id
  ) => {
    if (rootState.conversationAttributes.id === id) {
      if (rootGetters['conversation/getHasLoadFailed']) {
        await dispatch(
          'conversation/fetchOldConversations',
          {},
          { root: true }
        );
      }
      return;
    }
    commit('switchThread');
    const { thread } = listState;
    dispatch('conversation/clearConversations', {}, { root: true });
    await dispatch('attach', id);
    if (listState.thread !== thread) return;
    await dispatch('conversation/fetchOldConversations', {}, { root: true });
  },

  // Points the thread on screen at a conversation, which is also how a new thread takes the
  // conversation its first message created.
  attach: async ({ state: listState, commit, dispatch }, id) => {
    const { thread } = listState;
    if (!findRecord(listState, id)) {
      commit(
        'conversationAttributes/SET_CONVERSATION_ATTRIBUTES',
        { id },
        { root: true }
      );
      await dispatch('fetch');
      if (listState.thread !== thread) return;
    }
    const record = findRecord(listState, id) || { id };
    commit('conversationAttributes/SET_CONVERSATION_ATTRIBUTES', record, {
      root: true,
    });
    commit('conversation/setMetaUserLastSeenAt', record.contact_last_seen_at, {
      root: true,
    });
    commit('markRead', id);
  },

  // A new thread cannot receive its conversation's messages until it knows the id.
  adopt: async ({ state: listState, dispatch }, id) => {
    const { thread } = listState;
    await dispatch('attach', id);
    if (listState.thread !== thread) return;
    await dispatch('conversation/syncLatestMessages', {}, { root: true });
  },

  updateLastMessage: ({ commit }, message) => {
    commit('setLastMessage', message);
  },

  // The previous visitor's previews must not stay on screen, nor be restored by a late response.
  switchIdentity: ({ commit }) => {
    commit('switchIdentity');
  },

  startNew: async ({ commit, dispatch }) => {
    commit('switchThread');
    await dispatch(
      'conversationAttributes/clearConversationAttributes',
      {},
      { root: true }
    );
    await dispatch('conversation/clearConversations', {}, { root: true });
  },
};

export const mutations = {
  setRecords($state, { payload, page, hasNextPage, unreadCount }) {
    const known = new Set($state.records.map(record => record.id));
    $state.records =
      page === 1
        ? payload
        : [...$state.records, ...payload.filter(r => !known.has(r.id))];
    $state.page = page;
    $state.hasNextPage = hasNextPage;
    $state.unreadCount = unreadCount;
  },
  // Ids only grow, so an older message arriving late cannot replace a newer preview.
  setLastMessage($state, message) {
    const record = findRecord($state, message.conversation_id);
    if (!record || record.last_message?.id > message.id) return;
    record.last_message = message;
    record.last_activity_at = message.created_at;
    if (message.message_type === MESSAGE_TYPE.OUTGOING) {
      if (!record.unread_count) $state.unreadCount += 1;
      record.unread_count += 1;
    }
    $state.records = [
      record,
      ...$state.records.filter(item => item !== record),
    ];
  },
  switchThread($state) {
    $state.thread += 1;
  },
  switchIdentity($state) {
    $state.identity += 1;
    $state.records = [];
    $state.page = 0;
    $state.hasNextPage = false;
    $state.unreadCount = 0;
    $state.uiFlags.isFetching = false;
  },
  setFetching($state, isFetching) {
    $state.uiFlags.isFetching = isFetching;
  },
  markRead($state, id) {
    const record = findRecord($state, id);
    if (!record?.unread_count) return;
    record.unread_count = 0;
    $state.unreadCount -= 1;
  },
};

export default {
  namespaced: true,
  state,
  getters,
  actions,
  mutations,
};
