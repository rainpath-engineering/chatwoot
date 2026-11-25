import { createStore } from 'vuex';
import { API } from 'widget/helpers/axios';
import conversation from '../../conversation';
import conversationAttributes from '../../conversationAttributes';
import conversationList from '../../conversationList';

vi.mock('widget/helpers/axios');

const fresh = module => ({ ...module, state: structuredClone(module.state) });

const buildStore = () =>
  createStore({
    modules: {
      conversation: fresh(conversation),
      conversationAttributes: fresh(conversationAttributes),
      conversationList: fresh(conversationList),
    },
  });

// Conversation 1 is on screen with message 100; conversation 2 is older and holds message 50.
const olderMessage = {
  id: 50,
  conversation_id: 2,
  created_at: 5,
  content: 'Bonjour',
};

const isMessagesRequest = url => url.startsWith('/api/v1/widget/messages');

// Like the server: `after` returns only newer messages of the requested conversation.
const serveOlderConversation = (url, { params } = {}) => {
  if (!isMessagesRequest(url)) return new Promise(() => {});
  const payload = params?.after >= olderMessage.id ? [] : [olderMessage];
  return Promise.resolve({ data: { payload, meta: {} } });
};

const goOffline = () =>
  API.get.mockImplementation(url =>
    isMessagesRequest(url)
      ? Promise.reject(new Error('Network Error'))
      : new Promise(() => {})
  );

const shownMessageIds = store =>
  Object.keys(store.getters['conversation/getConversation']).map(Number);

describe('switching conversations while offline', () => {
  let store;

  beforeEach(() => {
    window.chatwootWebChannel = { enabledFeatures: ['multiple_conversations'] };
    store = buildStore();
    store.commit('conversationList/setRecords', {
      payload: [
        { id: 1, status: 'open', unread_count: 0 },
        { id: 2, status: 'open', unread_count: 0 },
      ],
      page: 1,
      hasNextPage: false,
      unreadCount: 0,
    });
    store.commit('conversationAttributes/SET_CONVERSATION_ATTRIBUTES', {
      id: 1,
    });
    store.commit('conversation/setMessagesInConversation', [
      { id: 100, conversation_id: 1, created_at: 10, content: 'Merci' },
    ]);
  });

  afterEach(() => {
    delete window.chatwootWebChannel;
  });

  it('catches up on the conversation opened offline once the socket reconnects', async () => {
    // The socket drops while conversation 1 is on screen.
    await store.dispatch('conversation/setLastMessageId');
    goOffline();
    await store.dispatch('conversationList/open', 2);
    expect(shownMessageIds(store)).toEqual([]);

    API.get.mockImplementation(serveOlderConversation);
    await store.dispatch('conversation/syncLatestMessages');

    expect(shownMessageIds(store)).toEqual([50]);
  });

  it('loads the conversation again when it is reopened after a failed load', async () => {
    goOffline();
    await store.dispatch('conversationList/open', 2);
    expect(shownMessageIds(store)).toEqual([]);

    API.get.mockImplementation(serveOlderConversation);
    await store.dispatch('conversationList/open', 2);

    expect(shownMessageIds(store)).toEqual([50]);
  });

  it('never reuses a cursor recorded in another conversation', async () => {
    goOffline();
    await store.dispatch('conversationList/open', 2);
    // A disconnect noticed late records the cursor while conversation 2 is still empty.
    await store.dispatch('conversation/setLastMessageId');

    API.get.mockImplementation(serveOlderConversation);
    await store.dispatch('conversation/syncLatestMessages');

    expect(API.get).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/widget/messages'),
      { params: { before: undefined, after: null } }
    );
    expect(shownMessageIds(store)).toEqual([50]);
  });
});
