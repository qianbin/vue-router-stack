import _Vue from 'vue'
import Router, { Route, RouteRecord } from 'vue-router'

export type Options = {
    router: Router
}

export interface Entry extends Route {
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
    readonly appTriggered: boolean
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
    let appTriggerN = 0

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
                },
                get appTriggered() {
                    return appTriggerN > 0
                }
            }
        }
    })

    const history = window.history
    let depth = (history.state || {}).__depth || 0
    const pushStateFn = history.pushState.bind(history)
    const replaceStateFn = history.replaceState.bind(history)
    const goFn = history.go.bind(history)

    history.pushState = (data, title, url) => {
        appTriggerN = 1
        data = data || {}
        depth++
        pushStateFn({
            __depth: depth,
            ...data
        }, title, url)
    }
    history.replaceState = (data, title, url) => {
        appTriggerN = 1
        data = data || {}
        replaceStateFn({
            __depth: depth,
            ...data
        }, title, url)
    }
    history.go = (delta) => {
        appTriggerN = 2
        goFn(delta)
    }
    // for the case manually input url to navigate
    window.addEventListener('popstate', () => {
        appTriggerN--
        const data = history.state || {}
        if (typeof data.__depth === 'number') {
            depth = data.__depth
        } else {
            depth++
            replaceStateFn({
                __depth: depth,
                ...data
            }, '')
        }
    })

    router.afterEach((to, from) => {
        // pushState/replaceState is called after afterEach, 
        // use setTimeout to wait for them
        setTimeout(() => {
            const state = history.state || {}
            const depth = state.__depth
            const i = stack.entries.findIndex(e => e.depth >= depth)
            if (i >= 0) {
                stack.entries.splice(i)
            }
            stack.entries.push({
                ...to,
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
