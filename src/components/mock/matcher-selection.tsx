import * as _ from 'lodash';
import * as React from 'react';
import { observer } from 'mobx-react';
import { action, observable } from 'mobx';
import * as semver from 'semver';

import { matchers } from 'mockttp';

import { styled } from '../../styles';
import { FontAwesomeIcon } from '../../icons';
import { serverVersion as serverVersionObservable, HOST_MATCHER_SERVER_RANGE } from '../../services/service-versions';
import { Button, Select } from '../common/inputs';

import {
    Matcher,
    MatcherClass,
    MatcherKeys,
    MatcherLookup,
    MatcherClassKey,
    InitialMatcher,
    InitialMatcherClass,
    InitialMatcherClasses
} from '../../model/rules/rules';
import {
    summarizeMatcherClass
} from '../../model/rules/rule-descriptions';

import { MatcherConfiguration } from './matcher-config';

const getMatcherKey = (m: MatcherClass | Matcher | undefined) =>
    m === undefined
        ? ''
        : MatcherKeys.get(m as any) || MatcherKeys.get(m.constructor as any);
const getMatcherClassByKey = (k: MatcherClassKey) => MatcherLookup[k];

const MatcherRow = styled.li`
    display: flex;
    flex-direction: row;
    margin: 5px 0;

    &:first-child {
        margin-top: 0;
    }

    &:last-child {
        margin-bottom: 0;
    }
`;

const MatcherInputsContainer = styled.div`
    flex: 1 1 100%;
`;

const MatcherButton = styled(Button)`
    font-size: ${p => p.theme.textSize};
    padding: 6px 10px;
    display: inline-block;
    margin-left: 5px;
`;

export const InitialMatcherRow = React.forwardRef((p: {
    matcher?: InitialMatcher,
    onChange: (m: InitialMatcher) => void
}, ref: React.Ref<HTMLSelectElement>) => {
    return <MatcherRow>
        <MatcherInputsContainer>
            <Select
                ref={ref}
                value={getMatcherKey(p.matcher)}
                onChange={(event) => {
                    const value = event.currentTarget.value as MatcherClassKey | undefined;
                    if (value) {
                        const MatcherCls = getMatcherClassByKey(value) as InitialMatcherClass;
                        p.onChange(new MatcherCls());
                    }
                }}
            >
                { p.matcher === undefined &&
                    <option value={''}>
                        Never
                    </option>
                }

                <MatcherOptions matchers={InitialMatcherClasses} />
            </Select>
        </MatcherInputsContainer>
    </MatcherRow>
});

interface ExistingMatcherRowProps {
    matcher: Matcher;
    matcherIndex: number;
    onDelete: () => void;
    onChange: (m: Matcher, ...ms: Matcher[]) => void;
}

@observer
export class ExistingMatcherRow extends React.Component<ExistingMatcherRowProps> {
    render() {
        const { matcher, onChange, onDelete, matcherIndex } = this.props;

        return <MatcherRow>
            <MatcherInputsContainer>
                <MatcherConfiguration
                    matcherIndex={matcherIndex}
                    matcher={matcher}
                    onChange={onChange}
                />
            </MatcherInputsContainer>

            <MatcherButton onClick={onDelete}>
                <FontAwesomeIcon icon={['far', 'trash-alt']} />
            </MatcherButton>
        </MatcherRow>;
    }
}


const MatcherOptions = (p: { matchers: Array<MatcherClass> }) => <>{
    p.matchers.map((matcher): JSX.Element | null => {
        const key = getMatcherKey(matcher);
        const description = summarizeMatcherClass(matcher);

        return description
            ? <option key={key} value={key}>
                { description }
            </option>
            : null;
    })
}</>

const NewMatcherConfigContainer = styled.form`
    :not(:empty) {
        margin-top: 5px;
    }
`;

const LowlightedOption = styled.option`
    color: ${p => p.theme.containerWatermark};
`;

@observer
export class NewMatcherRow extends React.Component<{
    onAdd: (matcher: Matcher) => void,
    existingMatchers: Matcher[]
}> {

    @observable
    matcherClass: MatcherClass | undefined;

    @observable
    draftMatchers: Array<Matcher> = [];

    @observable
    invalidMatcherState = false;

    private dropdownRef = React.createRef<HTMLSelectElement>();

    @action.bound
    selectMatcher(event: React.ChangeEvent<HTMLSelectElement>) {
        const matcherKey = event.target.value as MatcherClassKey;
        this.matcherClass = MatcherLookup[matcherKey];

        // Clear the existing matchers:
        this.updateDraftMatcher();
    }

    @action.bound
    updateDraftMatcher(...matchers: Matcher[]) {
        this.draftMatchers = matchers;
        this.invalidMatcherState = false;
    }

    @action.bound
    markMatcherInvalid() {
        this.invalidMatcherState = true;
    }

    @action.bound
    saveMatcher(e?: React.FormEvent) {
        if (e) e.preventDefault();

        if (!this.draftMatchers.length) return;
        this.draftMatchers.forEach(m => this.props.onAdd(m));

        this.matcherClass = undefined;
        this.draftMatchers = [];
        this.invalidMatcherState = false;

        // Reset the focus ready to add another element
        const dropdown = this.dropdownRef.current;
        if (dropdown) dropdown.focus();
    }

    render() {
        const {
            matcherClass,
            draftMatchers,
            updateDraftMatcher,
            invalidMatcherState,
            markMatcherInvalid,
            saveMatcher
        } = this;

        const serverVersion = serverVersionObservable.state === 'fulfilled'
            ? serverVersionObservable.value as string
            : undefined;

        const availableMatchers = [
            serverVersion && semver.satisfies(serverVersion, HOST_MATCHER_SERVER_RANGE) && matchers.HostMatcher,
            matchers.SimplePathMatcher,
            matchers.RegexPathMatcher,
            matchers.ExactQueryMatcher,
            matchers.HeaderMatcher
        ].filter((matcherClass) => {
            if (!matcherClass) return false;

            if (
                matcherClass === matchers.SimplePathMatcher ||
                matcherClass === matchers.RegexPathMatcher
            ) {
                // You're allowed max 1 path matcher, across both types
                return !_.some(this.props.existingMatchers, (m) =>
                    m instanceof matchers.SimplePathMatcher ||
                    m instanceof matchers.RegexPathMatcher
                );
            } else {
                // For other matchers, there can just only be one of each type
                return !_.some(this.props.existingMatchers, (m) => m instanceof matcherClass)
            }
        }) as MatcherClass[];

        if (availableMatchers.length === 0) return null;

        return <MatcherRow>
            <MatcherInputsContainer>
                <Select
                    onChange={this.selectMatcher}
                    value={getMatcherKey(matcherClass)}
                    ref={this.dropdownRef}
                >
                    <LowlightedOption value={''}>Add another matcher:</LowlightedOption>
                    <LowlightedOption disabled>─────────────</LowlightedOption>
                    <MatcherOptions matchers={availableMatchers} />
                </Select>

                <NewMatcherConfigContainer onSubmit={
                    !invalidMatcherState && draftMatchers.length
                        ? saveMatcher
                        : (e) => e.preventDefault()
                }>
                    { draftMatchers.length >= 1
                        ? <MatcherConfiguration
                            matcherIndex={undefined}
                            matcher={draftMatchers[0]}
                            onChange={updateDraftMatcher}
                            onInvalidState={markMatcherInvalid}
                        />
                        : <MatcherConfiguration
                            matcherIndex={undefined}
                            matcherClass={matcherClass}
                            onChange={updateDraftMatcher}
                            onInvalidState={markMatcherInvalid}
                        />
                    }
                </NewMatcherConfigContainer>
            </MatcherInputsContainer>

            <MatcherButton
                disabled={!draftMatchers.length || invalidMatcherState}
                onClick={saveMatcher}
            >
                <FontAwesomeIcon icon={['fas', 'plus']} />
            </MatcherButton>
        </MatcherRow>;
    }
}