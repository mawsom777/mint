<?php
function formatDate($dateString): array
{
    $timezone = new DateTimeZone('Europe/Moscow');
    $date = DateTime::createFromFormat('Y-m-d H:i:s', $dateString, $timezone);
    $now = new DateTime('now', $timezone);
    $today = new DateTime('today', $timezone);
    $yesterday = new DateTime('yesterday', $timezone);

    $monthOfYear = (int)$date->format('n'); // 1-январь, 12-декабрь
    $months = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля', 'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];

    $dateMidnight = clone $date;
    $dateMidnight->setTime(0, 0);

    if ($dateMidnight == $today) {
        return ["Сегодня", $date->format('H:i'), $date->format('H:i')];
    }

    if ($dateMidnight == $yesterday) {
        return ["Вчера", $date->format('H:i'), $date->format('H:i')];
    }

    $sevenDaysAgo = (new DateTime())->modify('-7 days')->setTime(0, 0, 0);
    if ($dateMidnight > $sevenDaysAgo) {
        $dayOfWeek = (int)$date->format('N'); // 1-понедельник, 7-воскресенье
        $days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
        $shortDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        return [$days[$dayOfWeek - 1] . ', ' . $date->format('j') . ' ' . $months[$monthOfYear - 1], $date->format('H:i'), $shortDays[$dayOfWeek - 1]];
    }

    if ($date->format('Y') == $now->format('Y')) {
        return [$date->format('d') . ' ' . $months[$monthOfYear - 1], $date->format('H:i')];
    }

    return [$date->format('d') . ' ' . $months[$monthOfYear - 1] . ' ' . $date->format('Y'), $date->format('H:i')];
}
