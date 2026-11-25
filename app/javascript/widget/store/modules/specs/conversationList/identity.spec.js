import { createStore } from 'vuex';
import { API } from 'widget/helpers/axios';
import contacts from '../../contacts';
import conversationList from '../../conversationList';

vi.mock('widget/helpers/axios');

const deferred = () => {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
};

const flushPromises = () =>
  new Promise(resolve => {
    setTimeout(resolve, 0);
  });

const listResponse = payload => ({
  data: { payload, meta: { has_next_page: false, unread_count: 0 } },
});

const buildStore = () =>
  createStore({
    modules: {
      contacts,
      conversationList: {
        ...conversationList,
        state: structuredClone(conversationList.state),
      },
      conversationAttributes: {
        namespaced: true,
        state: { id: '' },
        actions: { clearConversationAttributes: () => {} },
        mutations: { SET_CONVERSATION_ATTRIBUTES: () => {} },
      },
      conversation: {
        namespaced: true,
        actions: {
          clearConversations: () => {},
          fetchOldConversations: () => {},
        },
        mutations: { setMetaUserLastSeenAt: () => {} },
      },
    },
  });

describe('conversation list across a setUser identity switch', () => {
  beforeEach(() => {
    window.chatwootWebChannel = { enabledFeatures: ['multiple_conversations'] };
  });

  afterEach(() => {
    delete window.chatwootWebChannel;
  });

  it('never shows the previous visitor list when its response arrives last', async () => {
    const previousVisitorList = deferred();
    const currentVisitorList = deferred();
    const lists = [previousVisitorList.promise, currentVisitorList.promise];
    API.get.mockImplementation(url =>
      url.includes('/conversations/list')
        ? lists.shift()
        : Promise.resolve({ data: {} })
    );
    API.patch.mockResolvedValue({ data: { widget_auth_token: 'token-b' } });
    const store = buildStore();

    const staleFetch = store.dispatch('conversationList/fetch');
    await store.dispatch('contacts/setUser', {
      identifier: 'visitor-b',
      user: { identifier_hash: 'hash-b' },
    });

    currentVisitorList.resolve(
      listResponse([{ id: 20, status: 'open', unread_count: 0 }])
    );
    await flushPromises();
    previousVisitorList.resolve(
      listResponse([{ id: 10, status: 'open', unread_count: 3 }])
    );
    await staleFetch;
    await flushPromises();

    const ids = store.getters['conversationList/getRecords'].map(
      record => record.id
    );
    expect(ids).toEqual([20]);
    expect(store.getters['conversationList/getIsFetching']).toBe(false);
  });

  it('drops the previous visitor list as soon as the identity changes', async () => {
    API.get.mockImplementation(url =>
      url.includes('/conversations/list')
        ? new Promise(() => {})
        : Promise.resolve({ data: {} })
    );
    API.patch.mockResolvedValue({ data: { widget_auth_token: 'token-b' } });
    const store = buildStore();
    store.commit('conversationList/setRecords', {
      payload: [{ id: 10, status: 'open', unread_count: 3 }],
      page: 1,
      hasNextPage: false,
      unreadCount: 1,
    });

    await store.dispatch('contacts/setUser', {
      identifier: 'visitor-b',
      user: { identifier_hash: 'hash-b' },
    });

    expect(store.getters['conversationList/getRecords']).toEqual([]);
  });
});
