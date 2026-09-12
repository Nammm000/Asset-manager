package tech.getarrays.assetmanager.spec;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import org.springframework.data.jpa.domain.Specification;
import tech.getarrays.assetmanager.constants.AssetConstants;
import tech.getarrays.assetmanager.dto.SavingsPassbookSearchRequestDTO;
import tech.getarrays.assetmanager.models.SavingsPassbook;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;

public final class SavingsPassbookSpecifications {

    private SavingsPassbookSpecifications() {
    }

    public static Specification<SavingsPassbook> forFilters(Long userId, SavingsPassbookSearchRequestDTO request) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("user").get("id"), userId));
            addPredicate(predicates, request.getPrincipalAmount(),
                    raw -> compare(root, cb, "principalAmount", raw, SavingsPassbookSpecifications::parseBigDecimal));
            addPredicate(predicates, request.getSavingsPassbookName(),
                    raw -> containsName(root, cb, raw));
            addPredicate(predicates, request.getDepositTerm(),
                    raw -> compare(root, cb, "depositTerm", raw, SavingsPassbookSpecifications::parseInteger));
            addPredicate(predicates, request.getInterestRate(),
                    raw -> compare(root, cb, "interestRate", raw, SavingsPassbookSpecifications::parseBigDecimal));
            addPredicate(predicates, request.getMaturityDate(),
                    raw -> compareDate(root, cb, "maturityDate", raw));
            addPredicate(predicates, request.getWithdrawalDate(),
                    raw -> compareDate(root, cb, "withdrawalDate", raw));
            addPredicate(predicates, request.getEstimatedMaturityProceeds(),
                    raw -> compare(root, cb, "estimatedMaturityProceeds", raw, SavingsPassbookSpecifications::parseBigDecimal));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static void addPredicate(List<Predicate> predicates, String raw, Function<String, Predicate> builder) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        predicates.add(builder.apply(raw));
    }

    private static Predicate containsName(Root<?> root, CriteriaBuilder cb, String raw) {
        String needle = "%" + raw.trim().toLowerCase() + "%";
        return cb.like(cb.lower(root.get("savingsPassbookName")), needle);
    }

    private static <Y extends Comparable<? super Y>> Predicate compare(
            Root<?> root, CriteriaBuilder cb, String field, String raw, Function<String, Y> parser) {
        Parsed parsed = parse(raw);
        Y value = parser.apply(parsed.value());
        Path<Y> path = root.get(field);
        return switch (parsed.op()) {
            case GT -> cb.greaterThan(path, value);
            case GTE -> cb.greaterThanOrEqualTo(path, value);
            case LT -> cb.lessThan(path, value);
            case LTE -> cb.lessThanOrEqualTo(path, value);
            case EQ -> cb.equal(path, value);
        };
    }

    // Date-only values are day-inclusive: ">d" starts at the next day's midnight, "<=d" runs through
    // 23:59:59.999999999, and equality matches the whole day as [start, start+1).
    private static Predicate compareDate(Root<?> root, CriteriaBuilder cb, String field, String raw) {
        Parsed parsed = parse(raw);
        Path<LocalDateTime> path = root.get(field);
        if (parsed.value().length() == 10) {
            LocalDateTime start = parseDate(parsed.value()).atStartOfDay();
            return switch (parsed.op()) {
                case GTE -> cb.greaterThanOrEqualTo(path, start);
                case GT -> cb.greaterThanOrEqualTo(path, start.plusDays(1));
                case LTE -> cb.lessThanOrEqualTo(path, start.plusDays(1).minusNanos(1));
                case LT -> cb.lessThan(path, start);
                case EQ -> cb.and(
                        cb.greaterThanOrEqualTo(path, start),
                        cb.lessThan(path, start.plusDays(1)));
            };
        }
        LocalDateTime value = parseDateTime(parsed.value());
        return switch (parsed.op()) {
            case GT -> cb.greaterThan(path, value);
            case GTE -> cb.greaterThanOrEqualTo(path, value);
            case LT -> cb.lessThan(path, value);
            case LTE -> cb.lessThanOrEqualTo(path, value);
            case EQ -> cb.equal(path, value);
        };
    }

    private record Parsed(Op op, String value) {
    }

    private enum Op {
        GT, GTE, LT, LTE, EQ
    }

    private static Parsed parse(String raw) {
        String trimmed = raw.trim();
        if (trimmed.startsWith(">=")) {
            return withValue(Op.GTE, trimmed.substring(2));
        }
        if (trimmed.startsWith("<=")) {
            return withValue(Op.LTE, trimmed.substring(2));
        }
        if (trimmed.startsWith(">")) {
            return withValue(Op.GT, trimmed.substring(1));
        }
        if (trimmed.startsWith("<")) {
            return withValue(Op.LT, trimmed.substring(1));
        }
        return withValue(Op.EQ, trimmed);
    }

    private static Parsed withValue(Op op, String value) {
        String trimmed = value.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
        return new Parsed(op, trimmed);
    }

    private static BigDecimal parseBigDecimal(String value) {
        try {
            return new BigDecimal(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
    }

    private static Integer parseInteger(String value) {
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
    }

    private static LocalDate parseDate(String value) {
        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
    }

    private static LocalDateTime parseDateTime(String value) {
        try {
            return LocalDateTime.parse(value);
        } catch (DateTimeParseException e) {
            throw new IllegalArgumentException(AssetConstants.INVALID_DATA);
        }
    }
}
