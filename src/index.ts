import _Vue from 'vue'
import Router, { Route, RouteRecord } from 'vue-router'

export type Options = {
    router: Router
}

export interface Entry extends Route {
    ts: number
    depth: number
}

export interface ScopedEntry extends Entry {
    record: RouteRecord
    component: Vue.Component
}

export interface Stack {
    readonly canGoBack: boolean
    readonly full: Entry[]
    readonly scoped: ScopedEntry[]
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
                get canGoBack() {
                    if (stack.entries.length > 0) {
                        return stack.entries[stack.entries.length - 1].depth > 0
                    }
                    return false
                },
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

    const history = window.history

    const pushStateFn = history.pushState.bind(history)
    const replaceStateFn = history.replaceState.bind(history)

    history.pushState = (data, title, url) => {
        pushStateFn({
            __ts: Date.now(),
            __depth: ((history.state || {}).__depth || 0) + 1,
            ...(data || {})
        }, title, url)
    }
    history.replaceState = (data, title, url) => {
        replaceStateFn({
            __ts: Date.now(),
            __depth: (history.state || {}).__depth || 0,
            ...(data || {})
        }, title, url)
    }
    // for the case manually input url to navigate
    window.addEventListener('popstate', ev => {
        const data = ev.state || {}
        replaceStateFn({
            __ts: Date.now(),
            __depth: ((history.state || {}).__depth || 0) + 1,
            ...(data || {})
        }, '')
    })

    router.afterEach((to, from) => {
        // pushState/replaceState is called after afterEach, 
        // use setTimeout to wait for them
        setTimeout(() => {
            const state = history.state || {}
            const ts = state.__ts
            const depth = state.__depth
            const i = stack.entries.findIndex(e => e.ts >= ts)
            if (i >= 0) {
                stack.entries.splice(i)
            }
            stack.entries.push({
                ...to,
                ts,
                depth
            })
        }, 0)
    })
}

declare module 'vue/types/vue' {
    interface Vue {
        $stack: Stack
    }
}
