import _Vue from 'vue'
import Router, { Route, RouteRecord } from 'vue-router'

export type Options = {
    router: Router
}

export interface Entry extends Route {
    ts: number
}

export interface ScopedEntry extends Entry {
    record: RouteRecord
    component: Vue.Component
}

export interface Stack {
    full: Entry[]
    scoped: ScopedEntry[]
}

function getScopeRoot(vm: Vue, entries: Entry[]): [RouteRecord, number] | undefined {
    while (vm) {
        for (const e of entries) {
            for (let i = 0; i < e.matched.length; i++) {
                const m = e.matched[i]
                if (vm === m.instances.default) {
                    return [m, i]
                }
            }
        }
        vm = vm.$parent
    }
}

function overwriteState(data: any, ts: number) {
    return { __ts: ts, ...(data || {}) }
}

export default function install(Vue: typeof _Vue, options?: Options) {
    if (!options || !options.router) {
        throw new Error('invalid options')
    }

    const router = options.router
    const stack = Vue.observable<{ entries: Entry[] }>({ entries: [] })

    Object.defineProperty(Vue.prototype, '$stack', {
        get(): Stack {
            const vm = this
            return {
                get full() { return stack.entries },
                get scoped() {
                    const root = getScopeRoot(vm, stack.entries)
                    if (!root) {
                        return []
                    }
                    const [rootRec, rootIndex] = root

                    let reversed = stack.entries.map(e => e).reverse()
                    const start = reversed.findIndex(e => e.matched[rootIndex] === rootRec && e.matched[rootIndex + 1])
                    if (start < 0) {
                        return []
                    }


                    reversed = reversed.slice(start)
                    const end = reversed.findIndex(e => e.matched[rootIndex] !== rootRec || !e.matched[rootIndex + 1])
                    if (end >= 0) {
                        reversed = reversed.slice(0, end)
                    }

                    return reversed
                        .reverse()
                        .map<ScopedEntry>(e => {
                            const rec = e.matched[rootIndex + 1]
                            return {
                                ...e,
                                get record() { return rec },
                                get component() { return rec.components.default as Vue.Component }
                            }
                        })
                }
            }
        }
    })

    let tsForPush: number
    const history = window.history

    const pushStateFn = history.pushState.bind(history)
    const replaceStateFn = history.replaceState.bind(history)

    history.pushState = (data, title, url) => {
        pushStateFn(overwriteState(
            data,
            tsForPush
        ), title, url)
    }
    history.replaceState = (data, title, url) => {
        replaceStateFn(overwriteState(
            data,
            tsForPush
        ), title, url)
    }

    let popStateCalled = false
    window.addEventListener('popstate', () => {
        popStateCalled = true
    })

    // pushState/replaceState is called after afterEach 
    // while popstate event is fired before afterEach
    router.afterEach((to, from) => {
        let ts: number
        if (popStateCalled) {
            // back or forward, means history.state.__ts was set
            ts = history.state.__ts
            popStateCalled = false
        } else {
            ts = tsForPush = Date.now()
        }

        const i = stack.entries.findIndex(e => e.ts >= ts)
        if (i >= 0) {
            stack.entries.splice(i)
        }
        stack.entries.push({
            ...to,
            ts
        })
    })
}

declare module 'vue/types/vue' {
    interface Vue {
        $stack: Stack
    }
}
